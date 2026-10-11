# OOM Watch

A Rust memory-evidence collector and typed Node.js SDK for APIs experiencing container memory pressure. The SDK combines Linux cgroup v2 measurements with Node/V8 metrics, retains bounded history and exports local diagnostic reports with explicit limitations.

**Status:** experimental 0.1.x. Live collection requires Linux cgroup v2. The tool does not automatically identify a memory leak, the responsible request or the killed process. Independent postmortem observation and automatic Kubernetes correlation are not implemented.

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

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md). Licensed under [MIT](LICENSE). Source repository: https://github.com/uppy19d0/oom-watch.
