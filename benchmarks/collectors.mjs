import { readFile, writeFile } from 'node:fs/promises';
import { performance, monitorEventLoopDelay } from 'node:perf_hooks';
import { cpus, platform, arch } from 'node:os';
import { join } from 'node:path';
import { collectMemory, createMemoryObserver } from '../packages/node/index.js';
import { decodeSnapshot } from '../packages/node/src/protocol.js';
import { enrichSnapshot } from '../packages/node/src/collector.js';

const [binaryPath, cgroupPath, outputPath, countArgument = '100'] = process.argv.slice(2);
const count = Number(countArgument);
if (!binaryPath || !cgroupPath || !outputPath || !Number.isInteger(count) || count < 10 || count > 10000) {
  throw new Error('Usage: node benchmarks/collectors.mjs <binary> <cgroup> <output.json> [samples=100]');
}
const options = { binaryPath, cgroupPath };
async function directNode() {
  const [current, limit, events] = await Promise.all(['memory.current', 'memory.max', 'memory.events'].map(name => readFile(join(cgroupPath, name), 'utf8')));
  const counters = new Map();
  for (const line of events.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 2 || !/^\d+$/.test(parts[1]) || counters.has(parts[0])) throw new Error('Malformed counter');
    counters.set(parts[0], parts[1]);
  }
  return enrichSnapshot(decodeSnapshot(JSON.stringify({
    currentBytes: current.trim(), limitBytes: limit.trim() === 'max' ? null : limit.trim(), oomKillCount: counters.get('oom_kill'),
  })));
}
const percentile = (sorted, fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
const measurements = [];
for (let round = 0; round < 3; round++) {
  const modes = ['rustOneShot', 'rustPersistent', 'directNode'];
  const order = [...modes.slice(round), ...modes.slice(0, round)];
  for (const mode of order) {
    const observer = mode === 'rustPersistent' ? createMemoryObserver(options) : null;
    const sample = mode === 'rustOneShot' ? () => collectMemory(options) : mode === 'rustPersistent' ? () => observer.sample() : directNode;
    const delay = monitorEventLoopDelay({ resolution: 10 });
    try {
      for (let index = 0; index < 5; index++) await sample();
      delay.enable();
      const cpu = process.cpuUsage();
      const started = performance.now();
      const durations = [];
      for (let index = 0; index < count; index++) {
        const before = performance.now();
        await sample();
        durations.push(performance.now() - before);
      }
      const elapsedMs = performance.now() - started;
      const parentCpu = process.cpuUsage(cpu);
      durations.sort((a, b) => a - b);
      measurements.push({ mode, round, samples: count, elapsedMs,
        latencyMs: { p50: percentile(durations, 0.5), p95: percentile(durations, 0.95), p99: percentile(durations, 0.99) },
        parentCpuMs: (parentCpu.user + parentCpu.system) / 1000,
        parentRssAtEndBytes: process.memoryUsage.rss(),
        eventLoopDelayP99Ms: delay.count ? delay.percentile(99) / 1e6 : null,
      });
    } finally { delay.disable(); if (observer) await observer.close(); }
  }
}
await writeFile(outputPath, JSON.stringify({
  schemaVersion: 1,
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model },
  methodology: 'Three rotated rounds; five warmup samples per mode; serialized back-to-back requests; Node metrics included in every mode. Direct Node reads files concurrently. Persistent process startup excluded after warmup.',
  limitations: ['Fixture microbenchmark, not API load or live OOM testing.', 'CPU and RSS measurements cover the parent Node process only, not total process-tree cost.', 'RSS is an end-of-round reading, not peak memory.', 'Event-loop delay may be unavailable in short rounds.', 'Results depend on hardware, cache, filesystem and scheduling.'],
  measurements,
}, null, 2) + '\n');
console.log(`Saved benchmark to ${outputPath}`);
