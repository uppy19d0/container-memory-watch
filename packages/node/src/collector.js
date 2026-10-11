import { getHeapStatistics } from 'node:v8';
import { decodeSnapshot } from './protocol.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);

/** Invoke the Rust collector without a shell. No collection happens on import. */
export async function collectMemory({ binaryPath, cgroupPath, timeoutMs = 2000 }) {
  if (!binaryPath || !cgroupPath) throw new TypeError('binaryPath and cgroupPath are required');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be a positive integer');
  const { stdout } = await execute(binaryPath, [cgroupPath], {
    timeout: timeoutMs, maxBuffer: 4096, killSignal: 'SIGKILL',
  });
  const snapshot = decodeSnapshot(stdout);
  return enrichSnapshot(snapshot);
}

/** Node metrics belong to this process, not the Rust collector. */
export function enrichSnapshot(snapshot) {
  return {
    timestamp: new Date().toISOString(),
    ...snapshot,
    nodeMemory: process.memoryUsage(),
    heapLimitBytes: getHeapStatistics().heap_size_limit,
  };
}
