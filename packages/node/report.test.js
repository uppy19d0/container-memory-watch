import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDiagnosticReport, createMemoryRecorder, writeDiagnosticReport } from './index.js';
const sample = (second = 0, overrides = {}) => ({
  timestamp: new Date(1000 * second).toISOString(),
  currentBytes: 90n, limitBytes: 100n, oomKillCount: 0n,
  heapLimitBytes: 100,
  nodeMemory: { rss: 85, heapUsed: 20, heapTotal: 40, external: 10, arrayBuffers: 5 },
  ...overrides,
});

test('container pressure and heap pressure are separate observations', () => {
  const report = createDiagnosticReport([sample()]);
  assert.ok(report.findings.some(f => f.code === 'CONTAINER_MEMORY_PRESSURE'));
  assert.ok(!report.findings.some(f => f.code === 'V8_HEAP_PRESSURE'));
  const heap = createDiagnosticReport([sample(0, { currentBytes: 10n, heapLimitBytes: 25 })]);
  assert.ok(heap.findings.some(f => f.code === 'V8_HEAP_PRESSURE'));
  assert.ok(!heap.findings.some(f => f.code === 'CONTAINER_MEMORY_PRESSURE'));
});
test('Kubernetes reason is explicit evidence; normal exits do not prove OOM', () => {
  const options = { termination: { source: 'kubernetes', reason: 'OOMKilled' } };
  assert.ok(createDiagnosticReport([sample()], options).findings.some(f => f.code === 'KUBERNETES_OOM_TERMINATION'));
  assert.ok(!createDiagnosticReport([sample()], { termination: { source: 'kubernetes', reason: 'Error' } }).findings.some(f => f.code === 'KUBERNETES_OOM_TERMINATION'));
});
test('kill baseline and reset intervals cannot inflate the known total', () => {
  const report = createDiagnosticReport([
    sample(0, { oomKillCount: 10n }), sample(1, { oomKillCount: 12n }),
    sample(2, { oomKillCount: 1n }), sample(3, { oomKillCount: 2n }),
  ]);
  assert.equal(report.evidence.observedOomKills, '3');
  assert.equal(report.evidence.counterResets, 1);
  assert.equal(createDiagnosticReport([sample(0, { oomKillCount: 20n })]).evidence.observedOomKills, '0');
  assert.doesNotThrow(() => JSON.stringify(report));
});
test('recorder bounds history, preserves order and isolates caller mutation', () => {
  const recorder = createMemoryRecorder({ capacity: 2 });
  const original = sample();
  recorder.record(original);
  original.nodeMemory.heapUsed = 99;
  assert.equal(recorder.report().evidence.nodeMemory.heapUsed, 20);
  recorder.record(sample(1));
  recorder.record(sample(2));
  assert.equal(recorder.size, 2);
  assert.equal(recorder.report().window.start, sample(1).timestamp);
  const report = recorder.report();
  report.evidence.nodeMemory.heapUsed = 99;
  assert.equal(recorder.report().evidence.nodeMemory.heapUsed, 20);
  recorder.reset();
  assert.equal(recorder.size, 0);
  assert.throws(() => recorder.report());
});
test('unknown limits remain unknown; malformed and unordered history fails', () => {
  const reading = sample(0, { limitBytes: null, heapLimitBytes: undefined });
  const report = createDiagnosticReport([reading]);
  assert.equal(report.evidence.heapUsageRatio, null);
  assert.equal(report.evidence.containerUsageRatio, null);
  assert.throws(() => createDiagnosticReport([sample(1), sample(0)]));
  assert.throws(() => createDiagnosticReport([sample(0, { currentBytes: -1n })]));
  assert.throws(() => createDiagnosticReport([sample(0, { nodeMemory: {} })]));
  assert.throws(() => createDiagnosticReport([sample()], { threshold: NaN }));
  assert.throws(() => createMemoryRecorder({ capacity: 10001 }));
});
test('atomic report replacement writes restricted permissions and leaves no temp files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oom-watch-report-'));
  try {
    const path = join(directory, 'report.json');
    await writeDiagnosticReport(path, createDiagnosticReport([sample()]));
    await writeDiagnosticReport(path, createDiagnosticReport([sample(1)]));
    assert.equal(JSON.parse(await readFile(path, 'utf8')).window.start, sample(1).timestamp);
    if (process.platform !== 'win32') assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await readdir(directory), ['report.json']);
    await assert.rejects(writeDiagnosticReport(join(directory, 'missing', 'report.json'), {}));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
