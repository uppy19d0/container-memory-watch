import test from 'node:test';
import assert from 'node:assert/strict';
import { collectMemory, analyzeMemory } from './index.js';
const sample = (kills, limit = 100n) => ({ currentBytes: 90n, limitBytes: limit, oomKillCount: kills });
test('historical kills are not new events on first observation', () => {
  assert.equal(analyzeMemory(sample(20n)).newOomKills, null);
  assert.equal(analyzeMemory(sample(22n), sample(20n)).newOomKills, 2n);
});
test('counter reset is unknown rather than a negative kill count', () => {
  assert.equal(analyzeMemory(sample(1n), sample(20n)).counterReset, true);
  assert.equal(analyzeMemory(sample(1n), sample(20n)).newOomKills, null);
});
test('unlimited memory does not generate pressure', () => {
  assert.equal(analyzeMemory(sample(0n, null)).underPressure, false);
  assert.equal(analyzeMemory(sample(0n)).underPressure, true);
  for (const threshold of [0, -1, 2, NaN]) assert.throws(() => analyzeMemory(sample(0n), null, threshold));
});
test('collector rejects missing configuration and unavailable binary', async () => {
  await assert.rejects(collectMemory({}), /required/);
  await assert.rejects(collectMemory({ binaryPath: '/nonexistent/oom-watch', cgroupPath: '/tmp' }));
});

test('Rust-to-Node collection preserves large counters and propagates corrupt evidence', {
  skip: !process.env.OOM_WATCH_BINARY,
}, async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), 'oom-watch-integration-'));
  try {
    await writeFile(join(directory, 'memory.current'), '9007199254740993\n');
    await writeFile(join(directory, 'memory.max'), 'max\n');
    await writeFile(join(directory, 'memory.events'), 'oom_kill 7\n');
    const options = { binaryPath: process.env.OOM_WATCH_BINARY, cgroupPath: directory };
    const reading = await collectMemory(options);
    assert.equal(reading.currentBytes, 9007199254740993n);
    assert.equal(reading.limitBytes, null);
    assert.equal(reading.oomKillCount, 7n);
    assert.ok(reading.nodeMemory.rss > 0);
    await writeFile(join(directory, 'memory.events'), 'oom_kill broken\n');
    await assert.rejects(collectMemory(options), /Memory collection failed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('protocol rejects corrupt types and preserves unsigned 64-bit boundaries', async () => {
  const { decodeSnapshot } = await import('./src/protocol.js');
  const valid = { currentBytes: '18446744073709551615', limitBytes: null, oomKillCount: '0' };
  assert.equal(decodeSnapshot(JSON.stringify(valid)).currentBytes, 18446744073709551615n);
  for (const output of ['null', '[]', '{}', '{']) assert.throws(() => decodeSnapshot(output));
  for (const value of [-1, '18446744073709551616', '-1', '1.5']) {
    assert.throws(() => decodeSnapshot(JSON.stringify({ ...valid, currentBytes: value })));
  }
  assert.throws(() => decodeSnapshot(JSON.stringify({ ...valid, limitBytes: '0' })));
});
