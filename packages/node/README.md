# OOM Watch for Node.js

A typed JavaScript SDK that combines Node/V8 memory metrics with Linux cgroup v2 evidence collected by Rust. It produces bounded local diagnostic reports for Node APIs experiencing container memory pressure.

**Status:** experimental 0.1.x. It reports evidence and investigation steps; it does not prove memory leaks, automatically identify the responsible request or guarantee prevention of OOM kills.

## Installation

```sh
npm install @oom-watch/node
```

Requirements: Node.js 22+, Rust 1.99.0 for building the bundled collector source, and Linux cgroup v2 for live collection. The npm package includes reviewed Rust source, not prebuilt binaries. Installation runs no scripts and downloads no collector executable.

Build the collector explicitly:

```sh
cargo build --release --locked --manifest-path node_modules/@oom-watch/node/collector/Cargo.toml
```

Copy the resulting binary from `collector/target/release/oom-watch` to a trusted location in your application image. Build for the deployment OS and architecture; a macOS binary cannot collect Linux cgroup data. Build once in a container build stage rather than compiling during application startup.

## Quick start

```ts
import {
  createMemoryObserver,
  createMemoryRecorder,
  writeDiagnosticReport,
} from '@oom-watch/node';

const observer = createMemoryObserver({
  binaryPath: '/opt/oom-watch/oom-watch',
  cgroupPath: '/sys/fs/cgroup',
  timeoutMs: 2000,
});
const recorder = createMemoryRecorder({ capacity: 120 });

try {
  recorder.record(await observer.sample());
  const report = recorder.report({ threshold: 0.8 });
  await writeDiagnosticReport('/var/reports/memory.json', report);
} finally {
  await observer.close();
}
```

Repeat sampling sequentially in your monitoring loop. The destination directory must exist. Handle sampling and storage errors independently from request handling. Keep an observer open across samples; creating it on every call loses the persistent transport benefit.

`/sys/fs/cgroup` is an example, not automatic workload discovery. Choose the actual workload's cgroup directory. Visible `memory.max` may omit ancestor restrictions. Reset history when the workload identity changes.

## API

| Function | Behavior |
| --- | --- |
| `collectMemory(options)` | One-shot Rust collection plus metrics from the calling Node process |
| `createMemoryObserver(options)` | Persistent collector with `sample(): Promise<MemorySample>` and `close(): Promise<void>` |
| `analyzeMemory(current, previous?, threshold?)` | Pressure ratio and counter delta; first observation/reset is unknown |
| `createMemoryRecorder({ capacity? })` | Bounded copied history; capacity defaults to 120, maximum 10,000 |
| `createDiagnosticReport(samples, options?)` | JSON-safe evidence, timeline, findings, actions and limitations |
| `writeDiagnosticReport(path, report)` | Explicit atomic replacement of a local report file |

Collector options require `binaryPath` and `cgroupPath`; `timeoutMs` defaults to 2,000. The persistent API allows one pending request and rejects overlap. Timeouts, malformed protocol data and collector failures terminate the observer; create a new instance for recovery. Always await `close()` during normal shutdown.

Samples use `bigint` for kernel integers. Reports encode those integers as decimal strings and use schema version 1. Use `heap_size_limit`, not `heapTotal`, to interpret V8 headroom. `arrayBuffers` is included in Node's `external`; do not add them together.

If you have verified Kubernetes termination data for the same lifecycle, pass `termination: { source: 'kubernetes', reason: 'OOMKilled' }` to report generation. This package does not fetch Kubernetes state or verify container identity. Exit code 137 alone is insufficient to establish OOM.

## Security and resource behavior

The SDK has zero runtime npm dependencies; the Rust collector has zero third-party Rust dependencies. It imports no background timers and uploads no telemetry. Collection is read-only, does not invoke a shell, caps cgroup file input and protocol frames, and retains bounded history. It does not require Docker socket access, root or Kubernetes credentials when the chosen memory files are readable.

Explicit exports use owner-only file permissions on POSIX. Atomic replacement does not guarantee power-loss durability. Reports can contain caller-supplied metadata; review destinations and retention. Only run a trusted collector executable. See [security policy](https://github.com/uppy19d0/oom-watch/blob/main/SECURITY.md).

## Limitations and performance

Persistent Rust collection avoids repeated process startup. Benchmarks from macOS fixture files are documented with methodology and raw results in the source repository; they are not Linux/API-load or total-resource guarantees. The persistent process is request-driven and stops on input EOF. It does not independently observe after the Node caller dies.

This version does not implement cgroup v1, mount discovery, effective ancestor limits, automatic Kubernetes correlation, kernel PID attribution or leak root cause. See the [architecture](https://github.com/uppy19d0/oom-watch/blob/main/docs/architecture.md) and [performance report](https://github.com/uppy19d0/oom-watch/blob/main/docs/performance-research.md).

## Development and license

Source: https://github.com/uppy19d0/oom-watch. See CONTRIBUTING.md for checks and CHANGELOG.md for release notes. Licensed under MIT; the complete license is included in this package. Scanner and provenance results must be checked for the exact release version; no 100% security score is claimed.
