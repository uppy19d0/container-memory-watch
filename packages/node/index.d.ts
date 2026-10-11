export interface CollectorOptions { binaryPath: string; cgroupPath: string; timeoutMs?: number; }
export interface MemorySample {
  timestamp: string;
  heapLimitBytes?: number;
  currentBytes: bigint;
  limitBytes: bigint | null;
  oomKillCount: bigint;
  nodeMemory: { rss: number; heapTotal: number; heapUsed: number; external: number; arrayBuffers: number };
}
export interface Analysis { usageRatio: number | null; underPressure: boolean; newOomKills: bigint | null; counterReset: boolean; }
export function collectMemory(options: CollectorOptions): Promise<MemorySample>;
export function analyzeMemory(current: MemorySample, previous?: MemorySample | null, threshold?: number): Analysis;

export interface ReportOptions {
  threshold?: number;
  termination?: { source: 'kubernetes'; reason: string } | null;
}
export interface DiagnosticReport {
  schemaVersion: 1;
  window: { start: string; end: string; sampleCount: number };
  termination: { source: 'kubernetes'; reason: string } | null;
  evidence: {
    currentBytes: string; limitBytes: string | null; observedOomKills: string;
    counterResets: number; containerUsageRatio: number | null; heapUsageRatio: number | null;
    nodeMemory: MemorySample['nodeMemory']; heapLimitBytes: number | null;
  };
  timeline: Array<{
    timestamp: string; currentBytes: string; limitBytes: string | null; oomKillCount: string;
    rssBytes: number; heapUsedBytes: number; externalBytes: number;
    arrayBufferBytes: number; heapLimitBytes: number | null;
  }>;
  findings: Array<{ code: string; evidence: string; action: string }>;
  limitations: string[];
}
export interface MemoryRecorder {
  record(sample: MemorySample): void;
  report(options?: ReportOptions): DiagnosticReport;
  reset(): void;
  readonly size: number;
}
export function createDiagnosticReport(samples: MemorySample[], options?: ReportOptions): DiagnosticReport;
export function createMemoryRecorder(options?: { capacity?: number }): MemoryRecorder;
export function writeDiagnosticReport(path: string, report: DiagnosticReport): Promise<void>;
export interface MemoryObserver {
  sample(): Promise<MemorySample>;
  close(): Promise<void>;
}
export function createMemoryObserver(options: CollectorOptions): MemoryObserver;
