import { setTimeout } from 'node:timers/promises';
import { createMemoryObserver, createMemoryRecorder, writeDiagnosticReport } from '../packages/node/index.js';

// This example records the Node process running this file, not another API PID.
// In your API, place these calls in the application and persist between samples.
const [binaryPath, cgroupPath, outputPath] = process.argv.slice(2);
if (!binaryPath || !cgroupPath || !outputPath) {
  console.error('Usage: node examples/api-memory-report.mjs <binary> <cgroup-directory> <report.json>');
  process.exitCode = 2;
} else {
  const recorder = createMemoryRecorder({ capacity: 120 });
  const observer = createMemoryObserver({ binaryPath, cgroupPath });
  try {
    for (let index = 0; index < 3; index++) {
      recorder.record(await observer.sample());
      await writeDiagnosticReport(outputPath, recorder.report());
      if (index < 2) await setTimeout(1000);
    }
  } finally {
    await observer.close();
  }
  console.log(`Saved memory evidence to ${outputPath}`);
}
