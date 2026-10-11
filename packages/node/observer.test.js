import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createMemoryObserver } from './index.js';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'oom-observer-'));
  await writeFile(join(directory, 'memory.current'), '80\n');
  await writeFile(join(directory, 'memory.max'), '100\n');
  await writeFile(join(directory, 'memory.events'), 'oom_kill 1\n');
  return directory;
}
test('persistent Rust collector reads fresh evidence, rejects overlap and closes', { skip: !process.env.OOM_WATCH_BINARY }, async () => {
  const directory = await fixture();
  const observer = createMemoryObserver({ binaryPath: process.env.OOM_WATCH_BINARY, cgroupPath: directory });
  try {
    const pending = observer.sample();
    await assert.rejects(observer.sample(), /already in progress/);
    assert.equal((await pending).oomKillCount, 1n);
    await writeFile(join(directory, 'memory.events'), 'oom_kill 3\n');
    assert.equal((await observer.sample()).oomKillCount, 3n);
    await writeFile(join(directory, 'memory.events'), 'oom_kill broken\n');
    await assert.rejects(observer.sample(), /Collector exited.*Memory collection failed/s);
    await observer.close();
    await assert.rejects(observer.sample(), /Collector exited/);
    await observer.close();
  } finally { await observer.close(); await rm(directory, { recursive: true, force: true }); }
});
test('collector errors propagate and unavailable binaries do not leak handles', async () => {
  const observer = createMemoryObserver({ binaryPath: '/nonexistent/oom-watch', cgroupPath: '/tmp' });
  try { await assert.rejects(observer.sample()); } finally { await observer.close(); }
});

async function mock(response, action) {
  const directory = await mkdtemp(join(tmpdir(), 'oom-observer-mock-'));
  const binaryPath = join(directory, 'collector');
  await writeFile(join(directory, 'response.json'), JSON.stringify(response));
  const program = `
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const response = JSON.parse(readFileSync(join(__dirname, 'response.json'), 'utf8'));
process.stdin.on('data', () => {
  if (response.output === undefined) return;
  if (response.splitAt === undefined) process.stdout.write(response.output);
  else {
    process.stdout.write(response.output.slice(0, response.splitAt));
    setTimeout(() => process.stdout.write(response.output.slice(response.splitAt)), 10);
  }
});
`;
  await writeFile(binaryPath, '#!' + process.execPath + '\n' + program, { mode: 0o700 });
  const observer = createMemoryObserver({ binaryPath, cgroupPath: directory, timeoutMs: 3000 });
  try { await action(observer); } finally { await observer.close(); await rm(directory, { recursive: true, force: true }); }
}
const frame = JSON.stringify({ protocolVersion: 1, snapshot: { currentBytes: '80', limitBytes: '100', oomKillCount: '1' } }) + '\n';
test('stream decoder accepts a response split across pipe chunks', async () => {
  await mock({ output: frame, splitAt: 20 }, async observer => {
    assert.equal((await observer.sample()).currentBytes, 80n);
  });
});
test('corrupt, unsupported and oversized frames terminate the observer', async () => {
  for (const output of ['{broken}\n', '{"protocolVersion":2}\n', 'x'.repeat(4097)]) {
    await mock({ output }, async observer => {
      await assert.rejects(observer.sample());
      await assert.rejects(observer.sample());
    });
  }
});
test('close cancels a pending request and stalled collectors time out', async () => {
  await mock({}, async observer => {
    const rejection = assert.rejects(observer.sample(), /closed during sample/);
    await observer.close();
    await rejection;
  });
  await mock({}, async observer => { await assert.rejects(observer.sample(), /timed out/); });
});
