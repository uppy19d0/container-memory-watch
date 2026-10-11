import { collectMemory, createMemoryRecorder, createDiagnosticReport, writeDiagnosticReport, createMemoryObserver, type DiagnosticReport } from '../index.js';

async function inspect() {
  const sample = await collectMemory({ binaryPath: '/opt/oom-watch', cgroupPath: '/sys/fs/cgroup' });
  const observer = createMemoryObserver({ binaryPath: '/opt/oom-watch', cgroupPath: '/sys/fs/cgroup' });
  try { await observer.sample(); } finally { await observer.close(); }
  const recorder = createMemoryRecorder({ capacity: 120 });
  recorder.record(sample);
  const report: DiagnosticReport = recorder.report({ termination: { source: 'kubernetes', reason: 'OOMKilled' } });
  const total: string = report.evidence.observedOomKills;
  await writeDiagnosticReport('/tmp/report.json', createDiagnosticReport([sample]));
  return total;
}
void inspect;
// @ts-expect-error Capacity is numeric.
createMemoryRecorder({ capacity: '120' });
// @ts-expect-error Kubernetes source is an explicit contract.
createDiagnosticReport([], { termination: { source: 'guess', reason: 'OOMKilled' } });

import { startMemoryWatch } from '../index.js';
const watch = await startMemoryWatch({ log(event) {
  if (event.event === 'memory_status') console.log(event.container?.currentBytes, event.nodeMemory.rss);
} });
const automaticReport = watch.report();
if (automaticReport?.mode === 'cgroup-v2') console.log(automaticReport.findings);
else console.log(automaticReport?.evidence.heapUsageRatio);
await watch.stop();

if (automaticReport) await writeDiagnosticReport('/tmp/memory.json', automaticReport);
