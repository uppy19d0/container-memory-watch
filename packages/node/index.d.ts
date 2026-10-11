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
export function writeDiagnosticReport(path: string, report: DiagnosticReport | NodeMemoryReport): Promise<void>;
export interface MemoryObserver {
  sample(): Promise<MemorySample>;
  close(): Promise<void>;
}
export function createMemoryObserver(options: CollectorOptions): MemoryObserver;

export interface NodeMemoryReport {
  schemaVersion: 1;
  mode: 'node-only';
  window: { start: string; end: string; sampleCount: number };
  evidence: { nodeMemory: MemorySample['nodeMemory']; heapLimitBytes: number; heapUsageRatio: number };
  timeline: Array<{ timestamp: string; nodeMemory: MemorySample['nodeMemory']; heapLimitBytes: number; heapUsageRatio: number }>;
  limitations: string[];
}
export type MemoryWatchReport = (DiagnosticReport & { mode: 'cgroup-v2' }) | NodeMemoryReport;
export type MemoryWatchEvent = {
  event: 'memory_status'; timestamp: string; mode: 'node-only' | 'cgroup-v2';
  underPressure: boolean; heapUnderPressure: boolean; heapUsageRatio: number;
  nodeMemory: MemorySample['nodeMemory']; heapLimitBytes: number;
  container: null | { currentBytes: string; limitBytes: string | null; usageRatio: number | null;
    oomKillCount: string; newOomKills: string | null; counterReset: boolean };
} | { event: 'memory_monitor_unavailable' | 'memory_monitor_stopped'; timestamp: string;
  mode: 'node-only' | 'cgroup-v2'; reason: string };
export interface MemoryWatchOptions {
  binaryPath?: string;
  cgroupPath?: string;
  timeoutMs?: number;
  intervalMs?: number;
  logEvery?: number;
  capacity?: number;
  threshold?: number;
  log?: (event: MemoryWatchEvent) => void | Promise<void>;
  signal?: AbortSignal;
}
export interface MemoryWatch {
  readonly state: { mode: 'node-only' | 'cgroup-v2'; available: boolean; underPressure: boolean;
    usageRatio: number | null; heapUsageRatio: number | null; stopped: boolean; loggerErrors: number };
  report(): MemoryWatchReport | null;
  stop(): Promise<void>;
}
export function startMemoryWatch(options?: MemoryWatchOptions): Promise<MemoryWatch>;
