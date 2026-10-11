import { analyzeMemory } from './analysis.js';

function validateSample(sample) {
  if (!Number.isFinite(Date.parse(sample.timestamp))) throw new TypeError('Invalid sample timestamp');
  for (const key of ['currentBytes', 'oomKillCount']) {
    if (typeof sample[key] !== 'bigint' || (sample[key] < 0n || sample[key] > 18446744073709551615n)) throw new TypeError(`Invalid ${key}`);
  }
  if (sample.limitBytes !== null && (typeof sample.limitBytes !== 'bigint' || (sample.limitBytes <= 0n || sample.limitBytes > 18446744073709551615n))) {
    throw new TypeError('Invalid limitBytes');
  }
  for (const key of ['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers']) {
    if (!Number.isSafeInteger(sample.nodeMemory?.[key]) || sample.nodeMemory[key] < 0) {
      throw new TypeError(`Invalid Node metric: ${key}`);
    }
  }
  if (sample.heapLimitBytes !== undefined && (!Number.isSafeInteger(sample.heapLimitBytes) || sample.heapLimitBytes <= 0)) {
    throw new TypeError('Invalid heapLimitBytes');
  }
}

/** Explain one workload lifecycle. Findings indicate evidence, never prove a leak. */
export function createDiagnosticReport(samples, { threshold = 0.8, termination = null } = {}) {
  if (!Array.isArray(samples) || samples.length === 0 || samples.length > 10000) {
    throw new RangeError('Report requires 1 to 10000 samples');
  }
  for (let index = 0; index < samples.length; index++) {
    validateSample(samples[index]);
    if (index && Date.parse(samples[index].timestamp) < Date.parse(samples[index - 1].timestamp)) {
      throw new RangeError('Samples must be chronological');
    }
  }
  if (termination !== null && (termination.source !== 'kubernetes' || typeof termination.reason !== 'string')) {
    throw new TypeError('Termination must contain a Kubernetes source and reason');
  }
  const first = samples[0];
  const latest = samples.at(-1);
  const analysis = analyzeMemory(latest, samples.length > 1 ? samples.at(-2) : null, threshold);
  let observedKills = 0n;
  let counterResets = 0;
  for (let index = 1; index < samples.length; index++) {
    const delta = samples[index].oomKillCount - samples[index - 1].oomKillCount;
    if (delta < 0n) counterResets++;
    else observedKills += delta;
  }
  const heapUsageRatio = latest.heapLimitBytes === undefined ? null : latest.nodeMemory.heapUsed / latest.heapLimitBytes;
  const findings = [];
  if (termination?.reason === 'OOMKilled') findings.push({
    code: 'KUBERNETES_OOM_TERMINATION',
    evidence: 'Caller-supplied Kubernetes termination reason is OOMKilled.',
    action: 'Correlate the container ID, restart and timestamps with this history; inspect node pressure as well as container limits.',
  });
  if (observedKills > 0n) findings.push({
    code: 'CGROUP_OOM_KILLS_OBSERVED',
    evidence: `${observedKills} OOM kills occurred in positive counter intervals.`,
    action: 'Confirm which process was killed using container termination or kernel event evidence.',
  });
  if (analysis.underPressure) findings.push({
    code: 'CONTAINER_MEMORY_PRESSURE',
    evidence: 'Latest cgroup consumption meets the configured warning threshold.',
    action: 'Inspect request concurrency, batch sizes and container headroom before changing limits.',
  });
  if (heapUsageRatio !== null && heapUsageRatio >= threshold) findings.push({
    code: 'V8_HEAP_PRESSURE',
    evidence: 'Latest heap usage meets the warning threshold relative to the V8 heap limit.',
    action: 'Profile retained objects in a controlled environment with memory headroom.',
  });
  if (counterResets) findings.push({
    code: 'COUNTER_RESET', evidence: 'OOM counters decreased inside this history.',
    action: 'Start a new recording for each workload lifecycle; do not attribute events across restarts.',
  });
  const limitations = [
    'Samples cannot establish a memory leak or the responsible request.',
    'Cgroup counters can include descendants and do not identify the Node PID.',
    'A visible unlimited cgroup may still be restricted by an ancestor.',
    'Sampling can miss bursts; Node and cgroup readings are not simultaneous.',
    'Termination evidence is supplied by the caller and is not fetched or identity-verified.',
  ];
  if (counterResets) limitations.push('Kill totals exclude unknown intervals where counters reset.');
  return {
    schemaVersion: 1,
    window: { start: first.timestamp, end: latest.timestamp, sampleCount: samples.length },
    termination: termination === null ? null : { source: termination.source, reason: termination.reason },
    evidence: {
      currentBytes: latest.currentBytes.toString(),
      limitBytes: latest.limitBytes?.toString() ?? null,
      observedOomKills: observedKills.toString(),
      counterResets,
      containerUsageRatio: analysis.usageRatio,
      heapUsageRatio,
      nodeMemory: Object.fromEntries(['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers'].map(key => [key, latest.nodeMemory[key]])),
      heapLimitBytes: latest.heapLimitBytes ?? null,
    },
    timeline: samples.map(sample => ({
      timestamp: sample.timestamp,
      currentBytes: sample.currentBytes.toString(),
      limitBytes: sample.limitBytes?.toString() ?? null,
      oomKillCount: sample.oomKillCount.toString(),
      rssBytes: sample.nodeMemory.rss,
      heapUsedBytes: sample.nodeMemory.heapUsed,
      externalBytes: sample.nodeMemory.external,
      arrayBufferBytes: sample.nodeMemory.arrayBuffers,
      heapLimitBytes: sample.heapLimitBytes ?? null,
    })),
    findings,
    limitations,
  };
}

/** A bounded in-memory history. Reset or recreate it on workload restart. */
export function createMemoryRecorder({ capacity = 120 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    throw new RangeError('capacity must be an integer from 1 to 10000');
  }
  const samples = new Array(capacity);
  let next = 0;
  let size = 0;
  return {
    record(sample) {
      validateSample(sample);
      if (size && Date.parse(sample.timestamp) < Date.parse(samples[(next + capacity - 1) % capacity].timestamp)) {
        throw new RangeError('Samples must be chronological');
      }
      // Copy only known fields: do not retain application payloads or mutable references.
      samples[next] = {
        timestamp: sample.timestamp, currentBytes: sample.currentBytes,
        limitBytes: sample.limitBytes, oomKillCount: sample.oomKillCount,
        heapLimitBytes: sample.heapLimitBytes,
        nodeMemory: Object.fromEntries(['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers'].map(key => [key, sample.nodeMemory[key]])),
      };
      next = (next + 1) % capacity;
      size = Math.min(size + 1, capacity);
    },
    report(options) {
      const history = Array.from({ length: size }, (_, index) => samples[(next - size + capacity + index) % capacity]);
      return createDiagnosticReport(history, options);
    },
    reset() { samples.fill(undefined); next = 0; size = 0; },
    get size() { return size; },
  };
}
