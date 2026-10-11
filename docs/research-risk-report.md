# Research, benefits and risk assessment

Research date: October 11, 2026. Sources are external primary documentation. These findings support design decisions; they do not certify production readiness.

## Recommendation

Start with a dependency-free Rust evidence collector and a typed Node wrapper using an asynchronous subprocess. Evaluate a long-running collector after measuring process creation overhead. Use an independent observer and external persistence for postmortem reporting. A library in a killed process cannot guarantee reporting after termination.

Rust provides memory safety without a garbage collector and can host bounded collection logic. It does not fix JavaScript retention, guarantee low overhead, or identify leaked objects from cgroup counters. For these very small file reads, performance superiority over JavaScript is unproven. The current implementation has no unsafe Rust and no third-party Rust or npm runtime dependencies.

## External findings

1. Linux cgroup v2 exposes `memory.current`, `memory.max` and `memory.events`. `max` means unlimited at that cgroup level; an ancestor may still impose a limit. `memory.events` is hierarchical, so descendants may contribute counts. `memory.events.local` provides local events. An `oom_kill` increment is cgroup evidence and does not alone identify a Node PID. Source: https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html
2. Node exposes RSS, V8 heap and external/ArrayBuffer memory. ArrayBuffer usage is included in external memory; adding them double-counts. RSS can grow despite stable heap because of allocator fragmentation. Source: https://nodejs.org/api/process.html#processmemoryusage
3. Heap snapshots block the main thread and can require roughly twice the heap memory. Automatic snapshots near container exhaustion may trigger the failure being investigated. They are deliberately absent from this prototype. Source: https://nodejs.org/en/learn/diagnostics/memory/using-heap-snapshot
4. Docker exit 137 represents SIGKILL, including explicit kills; it is insufficient to prove OOM. Docker emits an `oom` event, which a future observer can correlate with termination evidence. Sources: https://docs.docker.com/reference/cli/docker/container/ls/ and https://docs.docker.com/reference/cli/docker/system/events/
5. Kubernetes memory limits are enforced through kernel OOM kills. Workload termination evidence must be correlated with container identity, restart and sampled history. A sidecar can share node pressure and is not guaranteed to survive all failures. Source: https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
6. NAPI-RS supports async Rust work and thread-safe callbacks. A native addon is a future integration option but introduces binary distribution and in-process failure risks. Sources: https://napi.rs/docs/concepts/threadsafe-function and https://github.com/napi-rs/website/blob/main/pages/en/docs/more/async-concurrency.md

## Benefits and risks

| Area | Benefit | Risk / mitigation |
| --- | --- | --- |
| Rust core | Reusable collector with explicit errors and no runtime dependencies | Language alone does not establish performance; benchmark before claiming efficiency |
| Subprocess integration | No native addon ABI packaging; Node calls without a shell | Spawn cost and collector memory; serialize calls, set timeouts, measure overhead |
| cgroup evidence | Reads container-level consumption including memory beyond V8 | Wrong cgroup or ancestor limits can mislead; require explicit paths and implement discovery before production |
| OOM counters | Observable kernel evidence | Hierarchical counts, resets and historical events; baseline first sample, report reset as unknown, correlate identity |
| Pressure warnings | Can warn before an observed limit is reached | Sampling can miss sudden allocation bursts; no promise of prevention |
| Read-only design | No automatic workload tuning or privileged socket access | Future Docker/Kubernetes integrations need narrowly scoped access |
| Diagnostics | Node metrics help distinguish heap from other memory | Metrics cannot identify retained objects; profile separately with memory headroom |
| Data handling | No telemetry leaves the machine by default | Future reports can expose workload metadata; redact and define retention before export |
| Portability | Fixture-based parsing is testable outside Linux | Live support is cgroup v2 only; cgroup v1, mount discovery and ancestor effective limits are not implemented |

## Acceptance gates before production

Run real cgroup v2 tests with an intentionally memory-limited disposable workload; distinguish manual SIGKILL from OOM. Test restart identity changes, inaccessible controllers, nested limits and observer failure. Measure CPU, RSS and process-spawn cost at realistic sample intervals. Add external durable history with bounded retention and backpressure. Validate TypeScript consumers and package distribution on target architectures. Pin CI actions to audited commits before release.

## Verification scope

Unit tests cover integer overflow, unlimited/zero limits, malformed and duplicate events, unknown event keys, counter resets, baseline semantics, numeric precision and fixture collection. Node tests cover pressure thresholds, counter semantics and collector invocation failures. These checks do not exercise real OOM kills or establish leak attribution.

## Local validation results

Six Rust regression tests and twelve Node tests (including real Rust-to-Node fixture integration and report persistence) passed. The optimized binary built successfully; rustfmt and Clippy with warnings denied passed. Tests ran on macOS with synthetic cgroup files. The TypeScript consumer contract compiled successfully, and the three-sample report example ran end to end against synthetic cgroup files. Live Linux OOM behavior, overhead benchmarks and Docker/Kubernetes deployment remain unvalidated; the local Docker daemon is unavailable. Rust tools were installed only under `/tmp`, without changing the user's shell configuration.

## Persistent transport update

The SDK now supports a request-driven persistent Rust collector. Eight Rust tests and seventeen Node tests pass; TypeScript compilation, the optimized build, formatting and Clippy also pass. See [performance research](performance-research.md) for the measured startup improvement, reproducible harness and remaining production validation. Independent observation after target death is still unimplemented.
