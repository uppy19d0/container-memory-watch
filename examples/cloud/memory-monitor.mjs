import { access } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { join } from 'node:path';
import { analyzeMemory, createMemoryObserver, createMemoryRecorder } from '../../packages/node/index.js';

// Copy into your app and import these APIs from 'container-memory-watch'.
export async function startMemoryMonitoring({
  binaryPath = process.env.OOM_WATCH_BINARY ?? '/opt/oom-watch/oom-watch',
  cgroupPath = process.env.OOM_WATCH_CGROUP_PATH ?? '/sys/fs/cgroup',
  intervalMs = 5000,
  log = record => console.log(JSON.stringify(record)),
} = {}) {
  if (!Number.isInteger(intervalMs) || intervalMs < 1000) throw new RangeError('intervalMs must be at least 1000');
  const state = { available: false, underPressure: false, usageRatio: null };
  const controller = new AbortController();
  try {
    for (const file of ['memory.current', 'memory.max', 'memory.events']) await access(join(cgroupPath, file));
  } catch {
    log({ event: 'memory_monitor_unavailable', reason: 'Readable cgroup v2 memory files are required' });
    return { state, stop: async () => {} };
  }
  const observer = createMemoryObserver({ binaryPath, cgroupPath, timeoutMs: 2000 });
  const recorder = createMemoryRecorder({ capacity: 120 });
  const run = (async () => {
    let previous = null;
    let count = 0;
    try {
      while (!controller.signal.aborted) {
        const sample = await observer.sample();
        const analysis = analyzeMemory(sample, previous, 0.8);
        recorder.record(sample);
        const changed = !state.available || state.underPressure !== analysis.underPressure;
        Object.assign(state, { available: true, underPressure: analysis.underPressure, usageRatio: analysis.usageRatio });
        if (changed || count % 6 === 0) {
          log({ event: 'memory_evidence', report: recorder.report({ threshold: 0.8 }) });
        }
        previous = sample; count++;
        await delay(intervalMs, undefined, { signal: controller.signal });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        Object.assign(state, { available: false, underPressure: false, usageRatio: null });
        log({ event: 'memory_monitor_stopped', reason: error instanceof Error ? error.name : 'UnknownError' });
      }
    } finally {
      await observer.close();
    }
  })();
  return { state, stop: async () => { controller.abort(); await run; } };
}
