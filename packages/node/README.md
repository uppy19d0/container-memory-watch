# Container Memory Watch

A typed JavaScript SDK that combines Node/V8 memory metrics with Linux cgroup v2 evidence collected by Rust. It produces bounded local diagnostic reports for Node APIs experiencing container memory pressure.

**Status:** experimental 0.1.x. It reports evidence and investigation steps; it does not prove memory leaks, automatically identify the responsible request or guarantee prevention of OOM kills.

## Why add this to your API?

A container can approach its memory limit while JavaScript heap usage still looks comfortable. Watching only heap usage can therefore leave you investigating the wrong resource. This SDK puts container consumption and its visible limit beside Node RSS, V8 heap, external memory and array buffers, in one report.

| What you need to know | What the library adds | How it helps you act |
| --- | --- | --- |
| Is my container close to its visible limit? | Configurable pressure threshold and usage ratio | Alert or reduce admitted work before headroom is exhausted |
| Is pressure in the V8 heap too? | Heap usage relative to V8's actual heap limit | Decide whether to investigate retained JavaScript objects or broader memory consumption |
| Did the selected cgroup record new OOM kills? | Counter deltas with first-sample and reset handling | Separate historical counts from newly observed events |
| What happened before a restart? | Bounded timeline and explicit JSON export | Persist evidence during normal operation and correlate it with container events |

**Example:** with a visible 512 MiB limit and 450 MiB in use, container utilization is about 88%. At an 80% threshold, the SDK reports pressure even if the JavaScript heap is below its own threshold. Your application can stop admitting optional background jobs, reduce batch concurrency, or alert an operator. A threshold is a policy choice, not an estimate of time until failure.

Use it when your Node.js API runs in Linux cgroup v2 containers and you need application-level memory evidence without a hosted agent. If you already collect equivalent cgroup, V8 and timeline evidence with your monitoring stack, the incremental benefit may be small. Keep fleet monitoring and profilers for their respective jobs.

## How it helps reduce OOM risk

The library supplies signals; your application owns the response. Sample regularly, connect pressure to a bounded response such as delaying optional jobs, and persist reports before a kill. Measure the result under representative load before changing production limits. It does not release your objects, modify Kubernetes limits, throttle requests automatically or survive the death of its Node caller. Rapid allocation bursts can still outrun sampling.

Node's [memoryUsage API](https://nodejs.org/api/process.html#processmemoryusage) exposes process metrics; this package adds selected-cgroup evidence, analysis and report history. Kubernetes [memory limits](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/) remain enforced by the operating system. Rust provides bounded parsing and a persistent collector, not a claim that reading these files is always faster than JavaScript.

## Installation

Release status: `container-memory-watch@0.1.0` is published. Its registry tarball matches the inspected GitHub Actions artifact and includes provenance.

```sh
npm install container-memory-watch
```

Requirements: Node.js 22+, Rust 1.99.0 for building the bundled collector source, and Linux cgroup v2 for live collection. The npm package includes reviewed Rust source, not prebuilt binaries. Installation runs no scripts and downloads no collector executable.

Build the collector explicitly:

```sh
cargo build --release --locked --manifest-path node_modules/container-memory-watch/collector/Cargo.toml
```

Copy the resulting binary from `collector/target/release/oom-watch` to a trusted location in your application image. Build for the deployment OS and architecture; a macOS binary cannot collect Linux cgroup data. Build once in a container build stage rather than compiling during application startup.

## Quick start

```ts
import {
  createMemoryObserver,
  createMemoryRecorder,
  writeDiagnosticReport,
} from 'container-memory-watch';

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

## Connect a warning to your application

This finite loop demonstrates a pressure hook without overlapping collection. Replace the logging hook with your own admission policy or alert integration. Keep request handling separate from the monitoring task; a failed sampler should not become an API outage.

```js
import { setTimeout as delay } from 'node:timers/promises';
import { analyzeMemory, createMemoryObserver, createMemoryRecorder,
  writeDiagnosticReport } from 'container-memory-watch';

const observer = createMemoryObserver({
  binaryPath: '/opt/oom-watch/oom-watch',
  cgroupPath: '/sys/fs/cgroup',
});
const recorder = createMemoryRecorder({ capacity: 120 });
let previous = null;
try {
  for (let count = 0; count < 120; count++) {
    const sample = await observer.sample();
    const state = analyzeMemory(sample, previous, 0.8);
    recorder.record(sample);
    if (state.underPressure) {
      console.warn('Container memory pressure', { ratio: state.usageRatio });
      // Hook: pause OPTIONAL job admission using your application's policy.
    }
    // Persist during normal operation: SIGKILL cannot run a final export.
    await writeDiagnosticReport('/var/reports/memory.json', recorder.report());
    previous = sample;
    if (count < 119) await delay(5000);
  }
} catch (error) {
  console.error('Memory monitoring stopped; investigate collection/storage', error);
} finally {
  await observer.close();
}
```

This example keeps at most 120 samples; at a five-second delay it covers approximately ten minutes plus collection time. Create the report directory before running it. Persist the destination outside disposable container storage if you need evidence after replacement. For continuous use, put the loop under your application's cancellation and shutdown lifecycle and define recovery and alert deduplication.

## Read the result and choose a response

- `CONTAINER_MEMORY_PRESSURE`: inspect concurrency, large payloads, batch sizes and container headroom. Heap pressure need not be present.
- `V8_HEAP_PRESSURE`: investigate retained objects with a profiler in an environment with sufficient memory.
- `CGROUP_OOM_KILLS_OBSERVED`: correlate event timestamps with the killed container or process; the counter alone does not identify the victim.
- No finding: no configured threshold was met in the retained samples. This is not a guarantee that a spike, leak or ancestor restriction is absent.

Verify improvement with the same traffic and limits: compare pressure frequency, latency, throughput and observed restarts before and after your application change. Increasing a heap limit can consume container headroom; do not treat it as a universal fix.

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

Explicit exports use owner-only file permissions on POSIX. Atomic replacement does not guarantee power-loss durability. Reports can contain caller-supplied metadata; review destinations and retention. Only run a trusted collector executable. See [security policy](https://github.com/uppy19d0/container-memory-watch/blob/main/SECURITY.md).

## Limitations and performance

Persistent Rust collection avoids repeated process startup. Benchmarks from macOS fixture files are documented with methodology and raw results in the source repository; they are not Linux/API-load or total-resource guarantees. The persistent process is request-driven and stops on input EOF. It does not independently observe after the Node caller dies.

This version does not implement cgroup v1, mount discovery, effective ancestor limits, automatic Kubernetes correlation, kernel PID attribution or leak root cause. See the [architecture](https://github.com/uppy19d0/container-memory-watch/blob/main/docs/architecture.md) and [performance report](https://github.com/uppy19d0/container-memory-watch/blob/main/docs/performance-research.md).

## Development and license

Source: https://github.com/uppy19d0/container-memory-watch. See CONTRIBUTING.md for checks and CHANGELOG.md for release notes. Licensed under MIT; the complete license is included in this package. Scanner and provenance results must be checked for the exact release version; no 100% security score is claimed.

## Deploy in the cloud

Use the [cloud integration guide](https://github.com/uppy19d0/container-memory-watch/blob/main/docs/cloud-integration.md) for ECS EC2, Kubernetes, GKE and AKS examples, runtime checks, cancellation and log retention. Fargate, Cloud Run and Azure Container Apps compatibility depends on the memory files exposed by the deployed runtime.
