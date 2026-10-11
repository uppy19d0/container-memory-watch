import { collectorOptions } from './watch-config.js';
import { getHeapStatistics } from 'node:v8';
import { setTimeout as delay } from 'node:timers/promises';
import { createMemoryObserver } from './observer.js';
import { createMemoryRecorder } from './report.js';
import { analyzeMemory } from './analysis.js';


function integer(value, minimum, maximum, name) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
}

/** Start bounded monitoring. Importing the SDK starts no background work. */
export async function startMemoryWatch(options = {}) {
  const { intervalMs = 5000, logEvery = 6, capacity = 120, threshold = 0.8,
    log = event => console.log(JSON.stringify(event)), signal } = options;
  integer(intervalMs, 1000, 2147483647, 'intervalMs');
  integer(logEvery, 1, 10000, 'logEvery');
  integer(capacity, 1, 10000, 'capacity');
  integer(options.timeoutMs ?? 2000, 1, 2147483647, 'timeoutMs');
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new RangeError('threshold must be in (0, 1]');
  if (typeof log !== 'function') throw new TypeError('log must be a function');
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError('signal must be an AbortSignal');
  for (const name of ['binaryPath', 'cgroupPath']) {
    if (options[name] !== undefined && (typeof options[name] !== 'string' || !options[name])) throw new TypeError(`${name} must be a nonempty string`);
  }
  const controller = new AbortController();
  const state = { mode: 'node-only', available: false, underPressure: false, usageRatio: null,
    heapUsageRatio: null, stopped: false, loggerErrors: 0 };
  const recorder = createMemoryRecorder({ capacity });
  const history = new Array(capacity);
  let next = 0;
  let size = 0;
  let previous = null;
  let observer = null;
  let run = Promise.resolve();
  function emit(event) {
    try {
      const result = log(event);
      // Async sinks own their queue; absorb rejection to protect request handling.
      if (result && typeof result.then === 'function') result.catch(() => { state.loggerErrors++; });
    } catch { state.loggerErrors++; }
  }
  function report() {
    if (state.mode === 'cgroup-v2' && recorder.size) return { mode: 'cgroup-v2', ...recorder.report({ threshold }) };
    if (!size) return null;
    const timeline = Array.from({ length: size }, (_, index) => history[(next - size + capacity + index) % capacity]);
    const latest = timeline.at(-1);
    return { schemaVersion: 1, mode: 'node-only', window: { start: timeline[0].timestamp, end: latest.timestamp, sampleCount: size },
      evidence: { nodeMemory: { ...latest.nodeMemory }, heapLimitBytes: latest.heapLimitBytes, heapUsageRatio: latest.heapUsageRatio },
      timeline: timeline.map(item => ({ ...item, nodeMemory: { ...item.nodeMemory } })),
      limitations: ['Node-only evidence: container consumption, memory limit and OOM kill counters are unavailable.',
        'Heap pressure is not container pressure and does not prove a memory leak.'] };
  }
  async function stop() {
    controller.abort();
    await observer?.close();
    await run;
    state.stopped = true;
    signal?.removeEventListener('abort', onAbort);
  }
  function onAbort() { void stop(); }
  if (signal?.aborted) { state.stopped = true; return { get state() { return { ...state }; }, report, stop }; }
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    observer = createMemoryObserver(await collectorOptions(options));
    previous = await observer.sample();
    state.mode = 'cgroup-v2';
  } catch {
    await observer?.close(); observer = null;
    emit({ event: 'memory_monitor_unavailable', timestamp: new Date().toISOString(), mode: 'node-only',
      reason: 'Container evidence unavailable. Build the bundled collector and verify readable cgroup v2 files; Node metrics remain active.' });
  }
  let count = 0;
  async function tick(initial = false) {
    let sample;
    const previousMode = state.mode;
    if (observer) {
      try { sample = initial ? previous : await observer.sample(); }
      catch {
        if (controller.signal.aborted) return;
        await observer.close(); observer = null; previous = null; recorder.reset();
        Object.assign(state, { mode: 'node-only', available: false, underPressure: false, usageRatio: null });
        emit({ event: 'memory_monitor_unavailable', timestamp: new Date().toISOString(), mode: 'node-only', reason: 'Collector failed; Node metrics remain active. Restart monitoring after fixing collection.' });
      }
    }
    const nodeMemory = sample?.nodeMemory ?? process.memoryUsage();
    const heapLimitBytes = sample?.heapLimitBytes ?? getHeapStatistics().heap_size_limit;
    const heapUsageRatio = nodeMemory.heapUsed / heapLimitBytes;
    let analysis = null;
    const wasPressure = state.underPressure;
    if (sample) {
      analysis = analyzeMemory(sample, initial ? null : previous, threshold);
      recorder.record(sample); previous = sample;
      Object.assign(state, { available: true, underPressure: analysis.underPressure, usageRatio: analysis.usageRatio });
    }
    const heapChanged = (state.heapUsageRatio !== null && state.heapUsageRatio >= threshold) !== (heapUsageRatio >= threshold);
    state.heapUsageRatio = heapUsageRatio;
    const timestamp = sample?.timestamp ?? new Date().toISOString();
    history[next] = { timestamp, nodeMemory: { ...nodeMemory }, heapLimitBytes, heapUsageRatio };
    next = (next + 1) % capacity; size = Math.min(size + 1, capacity);
    if (count++ % logEvery === 0 || previousMode !== state.mode || wasPressure !== state.underPressure || heapChanged || (analysis?.newOomKills ?? 0n) > 0n || analysis?.counterReset) {
      emit({ event: 'memory_status', timestamp, mode: state.mode, underPressure: state.underPressure,
        heapUnderPressure: heapUsageRatio >= threshold, heapUsageRatio, nodeMemory: { ...nodeMemory }, heapLimitBytes,
        container: sample ? { currentBytes: sample.currentBytes.toString(), limitBytes: sample.limitBytes?.toString() ?? null,
          usageRatio: analysis.usageRatio, oomKillCount: sample.oomKillCount.toString(),
          newOomKills: analysis.newOomKills?.toString() ?? null, counterReset: analysis.counterReset } : null });
    }
  }
  if (!controller.signal.aborted) await tick(true);
  run = (async () => {
    try {
      while (!controller.signal.aborted) {
        await delay(intervalMs, undefined, { signal: controller.signal, ref: false });
        if (!controller.signal.aborted) await tick();
      }
    } catch (error) {
      if (!controller.signal.aborted) emit({ event: 'memory_monitor_stopped', timestamp: new Date().toISOString(), mode: state.mode, reason: 'Sampling failed' });
    } finally {
      await observer?.close(); Object.assign(state, { stopped: true, available: false, underPressure: false, usageRatio: null });
      signal?.removeEventListener('abort', onAbort);
    }
  })();
  return { get state() { return { ...state }; }, report, stop };
}
