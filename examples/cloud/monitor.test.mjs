import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startMemoryMonitoring } from './memory-monitor.mjs';

test('invalid cadence is rejected before collection', async () => {
  await assert.rejects(startMemoryMonitoring({ intervalMs: 0 }), RangeError);
});
test('missing cgroup files leave monitoring unavailable without stopping the API', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-monitor-'));
  try {
    const logs = [];
    const monitor = await startMemoryMonitoring({ cgroupPath: directory, log: record => logs.push(record) });
    assert.equal(monitor.state.available, false);
    assert.equal(logs[0].event, 'memory_monitor_unavailable');
    await monitor.stop();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('real collector emits JSON-safe pressure evidence and cancels its pending delay', { skip: !process.env.OOM_WATCH_BINARY }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-monitor-'));
  let monitor;
  try {
    await Promise.all([writeFile(join(directory, 'memory.current'), '90\n'), writeFile(join(directory, 'memory.max'), '100\n'), writeFile(join(directory, 'memory.events'), 'oom_kill 0\n')]);
    const logs = [];
    monitor = await startMemoryMonitoring({ cgroupPath: directory, intervalMs: 1000, log: record => logs.push(record) });
    for (let attempt = 0; attempt < 40 && !monitor.state.available; attempt++) await delay(50);
    assert.equal(monitor.state.available, true);
    assert.equal(monitor.state.underPressure, true);
    assert.equal(logs[0].report.evidence.currentBytes, '90');
    assert.doesNotThrow(() => JSON.stringify(logs[0]));
    await monitor.stop();
  } finally { await monitor?.stop(); await rm(directory, { recursive: true, force: true }); }
});
