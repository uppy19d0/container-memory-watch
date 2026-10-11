# Performance research and applied architecture

Date: October 11, 2026.

## Sources and design consequences

Node subprocess pipes have finite capacity. A producer that writes faster than a consumer can block. The persistent protocol therefore produces only one frame in response to one request, and the SDK permits one in-flight request without a queue. Source: [Node child process documentation](https://nodejs.org/api/child_process.html).

Rust buffered writes must be flushed explicitly when consumers need immediate visibility, and flushing reports output errors. The server explicitly flushes after each frame and propagates write failures. Source: [Rust Write documentation](https://doc.rust-lang.org/std/io/trait.Write.html).

Linux `memory.events` can produce file modification notifications. This offers a future event-driven path for faster OOM-event observation, while periodic metrics still need sampling. Notification handling, lifecycle changes and Linux behavior must be tested before implementing that path. Source: [kernel cgroup v2 documentation](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v2.html).

## Implemented improvements

The new Rust `--serve` mode keeps one process alive, validates fixed requests within a 16-byte read bound and flushes a versioned JSON response. It uses blocking pipe I/O for backpressure and no internal sample queue. EOF stops the server. Collection errors terminate it rather than inventing evidence.

The SDK now exposes `createMemoryObserver()`, with asynchronous `sample()` and `close()`. It bounds response frames to 4 KiB, retains at most 4 KiB of stderr text, rejects overlap, times out stalled samples, handles split pipe frames, rejects unsupported protocol versions and waits for child termination. Invalid responses terminate the session; recovery requires explicit creation of a new observer. Existing APIs remain available.

This transport is persistent but request-driven. It does not autonomously collect after the SDK process dies and is not yet a postmortem survivor. These properties must not be confused with independent observation.

## Local benchmark results

Environment: Apple M2, macOS arm64, Node v22.22.1, optimized Rust binary. Three rounds of 100 measured samples per mode, five warmup samples per round, rotated execution order and identical synthetic cgroup files. Every path also collects Node memory and V8 heap limit. Direct Node reads the three files concurrently; Rust reads them sequentially.

| Sampling path | Mean time per sample across rounds | Median round p95 latency |
| --- | ---: | ---: |
| Rust process started per sample | 2.139 ms | 2.238 ms |
| Persistent Rust process | 0.075 ms | 0.085 ms |
| Direct asynchronous Node file reads | 0.100 ms | 0.122 ms |

The persistent path reduced mean sampling time by about 28 times relative to the previous process-per-sample design in this run. Its measured latency was also lower than the direct Node baseline, but these small local differences do not establish superiority on Linux or under application load. Startup is included in one-shot sampling and amortized away by warmup in persistent sampling, matching their intended lifecycles.

Raw measurements: [local-results.json](../benchmarks/local-results.json). Reproducible harness: [collectors.mjs](../benchmarks/collectors.mjs).

```sh
node benchmarks/collectors.mjs ./target/release/oom-watch <cgroup-directory> ./benchmarks/results.json 100
```

The harness records parent-process CPU, end-of-round RSS and event-loop delay as additional observations. They do not measure Rust child CPU or memory. Short rounds may not contain enough timer samples to characterize event-loop delay. No API requests, real OOM events or Linux cgroup files were exercised. Results are not suitable for advertising total CPU, memory or tail-latency savings.

## Next evidence needed

Run the same harness against Linux cgroup v2, then exercise a real API at fixed request rates and concurrency. Measure the whole process tree's CPU and peak RSS, API p95/p99 latency, event-loop delay, missed sampling intervals and evidence retained after SIGKILL/OOM. Include cold starts, multiple workloads and storage costs. Determine sampling intervals and resource budgets from those measurements.

The defensible technical position is now an inspectable, bounded diagnostic SDK with an efficient persistent transport. Universal performance leadership, automatic root cause and survival after target death remain unproven.
