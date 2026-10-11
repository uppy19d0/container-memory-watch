// Stable public entry point; implementation modules remain internal.
export { collectMemory } from './src/collector.js';
export { analyzeMemory } from './src/analysis.js';
export { createDiagnosticReport, createMemoryRecorder } from './src/report.js';
export { writeDiagnosticReport } from './src/storage.js';
export { createMemoryObserver } from './src/observer.js';
