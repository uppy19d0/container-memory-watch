import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startMemoryWatch } from './index.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('zero-option entrypoint emits parseable stdout and stops cleanly', async () => {
  const code = `import { startMemoryWatch } from ${JSON.stringify(new URL('./index.js', import.meta.url).href)}; const monitor = await startMemoryWatch(); await monitor.stop();`;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '--eval', code], { timeout: 5000 });
  const events = stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.ok(events.some(event => event.event === 'memory_status' && event.nodeMemory.rss > 0));
});


async function fixture() {
  const path = await mkdtemp(join(tmpdir(), 'memory-watch-'));
  await Promise.all([writeFile(join(path, 'memory.current'), '90\n'), writeFile(join(path, 'memory.max'), '100\n'), writeFile(join(path, 'memory.events'), 'oom_kill 5\n')]);
  return path;
}

test('no configuration starts JSON logs and a report without a Rust installation', async () => {
  const events = [];
  const monitor = await startMemoryWatch({ cgroupPath: '/nonexistent-memory-watch', log: event => events.push(event) });
  try {
    assert.equal(monitor.state.mode, 'node-only');
    assert.equal(monitor.state.available, false);
    assert.equal(events[0].event, 'memory_monitor_unavailable');
    assert.equal(events[1].container, null);
    assert.ok(events[1].nodeMemory.rss > 0);
    assert.doesNotThrow(() => JSON.stringify(events));
    const report = monitor.report();
    assert.equal(report.mode, 'node-only');
    assert.equal(report.window.sampleCount, 1);
    report.timeline[0].nodeMemory.rss = 0;
    assert.ok(monitor.report().timeline[0].nodeMemory.rss > 0);
    const state = monitor.state; state.mode = 'cgroup-v2';
    assert.equal(monitor.state.mode, 'node-only');
  } finally { await monitor.stop(); }
  assert.equal(monitor.state.stopped, true);
});

test('configuration errors reject before sampling instead of silently degrading', async () => {
  for (const options of [{ intervalMs: 0 }, { intervalMs: 2147483648 }, { capacity: 10001 }, { logEvery: 0 },
    { threshold: NaN }, { timeoutMs: 0 }, { log: null }, { signal: {} }, { binaryPath: '' }]) {
    await assert.rejects(startMemoryWatch(options));
  }
});

test('throwing and rejected log sinks do not stop monitoring', async () => {
  for (const log of [() => { throw new Error('sink down'); }, async () => { throw new Error('sink down'); }]) {
    const monitor = await startMemoryWatch({ cgroupPath: '/nonexistent-memory-watch', log });
    await delay(0);
    assert.equal(monitor.state.loggerErrors, 2);
    assert.equal(monitor.report().window.sampleCount, 1);
    await monitor.stop();
  }
});

test('aborted startup produces no samples; active abort stops promptly and idempotently', async () => {
  const aborted = new AbortController(); aborted.abort();
  const monitor = await startMemoryWatch({ signal: aborted.signal, log: () => assert.fail('unexpected log') });
  assert.equal(monitor.report(), null); assert.equal(monitor.state.stopped, true);
  await monitor.stop();
  const controller = new AbortController();
  const active = await startMemoryWatch({ cgroupPath: '/nonexistent-memory-watch', signal: controller.signal, log: () => {} });
  controller.abort(); await active.stop(); await active.stop();
  assert.equal(active.state.stopped, true);
});

test('bounded Node history stops generating logs after stop', async () => {
  const events = [];
  const monitor = await startMemoryWatch({ cgroupPath: '/nonexistent-memory-watch', capacity: 2, intervalMs: 1000, logEvery: 1, log: event => events.push(event) });
  await delay(2150);
  assert.equal(monitor.report().window.sampleCount, 2);
  await monitor.stop(); const count = events.length;
  await delay(1050); assert.equal(events.length, count);
});

test('Rust evidence records initial unknown delta, OOM changes and pressure recovery', { skip: !process.env.OOM_WATCH_BINARY }, async () => {
  const path = await fixture(); const events = [];
  const monitor = await startMemoryWatch({ cgroupPath: path, binaryPath: process.env.OOM_WATCH_BINARY, intervalMs: 1000, capacity: 2, logEvery: 100, log: event => events.push(event) });
  try {
    assert.equal(monitor.state.mode, 'cgroup-v2');
    assert.equal(monitor.state.underPressure, true);
    assert.equal(events[0].container.newOomKills, null);
    await writeFile(join(path, 'memory.events'), 'oom_kill 6\n');
    await delay(1100);
    assert.equal(events.at(-1).container.newOomKills, '1');
    await writeFile(join(path, 'memory.current'), '10\n'); await delay(1100);
    assert.equal(monitor.state.underPressure, false);
    assert.equal(events.at(-1).container.usageRatio, 0.1);
    const report = monitor.report();
    assert.equal(report.mode, 'cgroup-v2'); assert.equal(report.window.sampleCount, 2);
    assert.doesNotThrow(() => JSON.stringify(report));
  } finally { await monitor.stop(); await rm(path, { recursive: true, force: true }); }
});

test('collector failure clears container pressure and replaces stale evidence with Node-only reports', async () => {
  const path = await fixture(); const events = [];
  const binary = join(path, 'collector');
  await writeFile(binary, '#!/usr/bin/env node\nlet n=0;process.stdin.on("data",()=>{if(n++)process.exit(1);else console.log(JSON.stringify({protocolVersion:1,snapshot:{currentBytes:"90",limitBytes:"100",oomKillCount:"0"}}));});\n');
  await chmod(binary, 0o700);
  const monitor = await startMemoryWatch({ cgroupPath: path, binaryPath: binary, intervalMs: 1000, log: event => events.push(event) });
  try {
    assert.equal(monitor.state.underPressure, true);
    await delay(1200);
    assert.equal(monitor.state.mode, 'node-only'); assert.equal(monitor.state.available, false);
    assert.equal(monitor.state.usageRatio, null); assert.equal(monitor.state.underPressure, false);
    assert.equal(monitor.report().mode, 'node-only');
    assert.equal(events.at(-1).event, 'memory_status'); assert.equal(events.at(-1).container, null);
    assert.ok(events.some(event => event.event === 'memory_monitor_unavailable'));
  } finally { await monitor.stop(); await rm(path, { recursive: true, force: true }); }
});
