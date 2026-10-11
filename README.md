# Container Memory Watch

A Rust memory-evidence collector and typed Node.js SDK for APIs experiencing container memory pressure. The SDK combines Linux cgroup v2 measurements with Node/V8 metrics, retains bounded history and exports local diagnostic reports with explicit limitations.

**Status:** experimental 0.1.x. Live collection requires Linux cgroup v2. The tool does not automatically identify a memory leak, the responsible request or the killed process. Independent postmortem observation and automatic Kubernetes correlation are not implemented.

## What problem does it solve?

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

The npm package name is `container-memory-watch`; the source repository is `container-memory-watch` and the Rust binary remains `oom-watch`. `container-memory-watch@0.1.0` is published with verified provenance. See the [SDK guide](packages/node/README.md) for installation and integration.

## Project layout

| Component | Responsibility |
| --- | --- |
| `src/model.rs` | Memory evidence and pure calculations |
| `src/cgroup/` | Bounded, read-only kernel-file collection and parsing |
| `src/observer.rs` | Persistent request-driven Rust transport |
| `src/protocol.rs` | Precision-preserving JSON format |
| `packages/node/src/` | Typed SDK integration, reports and explicit storage |
| `tests/` and SDK tests | Public behavior, failure handling and integration |

See [architecture](docs/architecture.md) for extension boundaries and [language decision](docs/language-decision.md) for the Rust tradeoffs.

## Build and verify

Use Rust 1.99.0 and Node.js 22 or newer:

```sh
npm ci --prefix packages/node --ignore-scripts
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
OOM_WATCH_BINARY="$PWD/target/release/oom-watch" npm test --prefix packages/node
npm run typecheck --prefix packages/node
```

The Rust collector has no third-party dependencies; the SDK has no runtime npm dependencies. Development dependencies are locked. Package installation runs no hooks or automatic collector downloads.

## Use the SDK

```ts
import { createMemoryObserver, createMemoryRecorder, writeDiagnosticReport } from './packages/node/index.js';

const observer = createMemoryObserver({
  binaryPath: '/opt/oom-watch/oom-watch',
  cgroupPath: '/sys/fs/cgroup',
  timeoutMs: 2000,
});
const recorder = createMemoryRecorder({ capacity: 120 });

try {
  recorder.record(await observer.sample());
  await writeDiagnosticReport('/var/reports/memory.json', recorder.report());
} finally {
  await observer.close();
}
```

Keep the observer open across repeated sequential samples. A maximum of one request is pending; overlap is rejected. Timeout or invalid protocol data ends the session. Paths are explicit operator inputs: `/sys/fs/cgroup` is correct only when it exposes the intended workload. The output directory must exist. Handle failures separately from API request processing and reset history across workload lifecycles.

Read the [standalone SDK documentation](packages/node/README.md) for npm installation, bundled collector builds, API contracts, limitations and report interpretation. The [runnable example](examples/api-memory-report.mjs) samples its own Node process. The [sample report](examples/sample-report.json) uses synthetic cgroup values; it is not an incident report.

## Evidence and product direction

[Performance research](docs/performance-research.md) compares the persistent Rust path, one-shot Rust and direct Node file reads with reproducible fixture measurements. Results are not production performance guarantees. [Market research](docs/market-research.md) records existing alternatives and the unvalidated opportunity hypothesis.

[Security assessment](docs/security-assessment.md) records completed checks and remaining gaps. [Release process](docs/release-process.md) describes package inspection, provenance, trusted publishing and scanner requirements. No 100% security or supply-chain score is claimed.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md). Licensed under [MIT](LICENSE). Source repository: https://github.com/uppy19d0/container-memory-watch.

## Cloud integration

See the [ECS, Kubernetes, GKE and AKS guide](docs/cloud-integration.md) for a multi-stage image, deployment templates, pressure-aware application hooks, structured logs and an operational validation process. Managed services such as Fargate, Cloud Run and Azure Container Apps require runtime compatibility checks.
