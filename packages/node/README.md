# Container Memory Watch

A typed JavaScript SDK that combines Node/V8 memory metrics with Linux cgroup v2 evidence collected by Rust. It produces bounded local diagnostic reports for Node APIs experiencing container memory pressure.

**Status:** experimental 0.2.x. It reports evidence and investigation steps; it does not prove memory leaks, automatically identify the responsible request or guarantee prevention of OOM kills.

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

## Start monitoring with one call

```sh
npm install container-memory-watch
```

```js
import { startMemoryWatch } from 'container-memory-watch';

const memory = await startMemoryWatch();
// Your API keeps running. JSON lines go to stdout immediately and about every 30s.
// Call await memory.stop() from your application's existing shutdown handler.
```

No configuration is required to start observing Node memory. The default is one sample every 5 seconds, one status log every 6 samples, an 80% pressure threshold and a bounded 120-sample history (approximately ten minutes). Pressure transitions, counter resets and newly observed OOM kills also trigger a status log at the next sample. No timers run merely because you import the package.

There are two explicit modes:

| Mode | What is measured | Preparation |
| --- | --- | --- |
| `node-only` | Calling Node process RSS, V8 heap, external memory and array buffers | Just install and start; works without Rust and on local development machines |
| `cgroup-v2` | Node metrics plus selected container consumption, visible memory limit and OOM counters | Build the bundled Rust source once for the deployment platform; readable Linux cgroup v2 files are required |

`memory_monitor_unavailable` explains when container collection is unavailable. Monitoring continues with Node metrics and `container: null`. **Node-only mode cannot tell whether the container is near its limit or confirm an OOM kill.** `underPressure` is container pressure; `heapUnderPressure` is a separate V8 signal. Neither proves a leak.

### Enable container evidence once during the image build

Requirements for this mode: Node.js 22+, Rust 1.99.0 at build time, Linux cgroup v2 at runtime.

```sh
cargo build --release --locked --manifest-path node_modules/container-memory-watch/collector/Cargo.toml
```

`startMemoryWatch()` discovers the bundled `collector/target/release/oom-watch` automatically, then `/opt/oom-watch/oom-watch`. In a multistage image, copy the binary to that second location; Rust is unnecessary in the final image. Build for the runtime OS/architecture. Installation has no hooks and downloads no executable. A `CARGO_TARGET_DIR` override changes the output location and requires an explicit `binaryPath` or `OOM_WATCH_BINARY`.

On Linux it resolves the process's unified cgroup path from `/proc/self/cgroup` under the conventional `/sys/fs/cgroup` mount. Alternate mounts, unusual namespace layouts and ancestor limits require operator verification; this is not complete mount or effective-limit discovery. Override only when necessary:

```js
const memory = await startMemoryWatch({
  binaryPath: '/opt/oom-watch/oom-watch',
  cgroupPath: '/sys/fs/cgroup', // Verify this directory belongs to your workload.
});
```

Overrides can also use `OOM_WATCH_BINARY` and `OOM_WATCH_CGROUP_PATH`; explicit options take precedence. Only trusted locations are used, never executable search through PATH or runtime compilation. Invalid options reject startup; collection failures degrade to Node-only mode. After repairing the collector, stop and start a new monitor to restore container evidence.

## What do the logs look like?

The default output is one JSON object per line, suitable for Docker, Kubernetes and cloud log collectors. This is an illustrative container status (bytes are the unit):

```json
{"event":"memory_status","timestamp":"2026-10-11T12:00:00.000Z","mode":"cgroup-v2","underPressure":true,"heapUnderPressure":false,"heapUsageRatio":0.25,"nodeMemory":{"rss":314572800,"heapTotal":201326592,"heapUsed":134217728,"external":83886080,"arrayBuffers":62914560},"heapLimitBytes":536870912,"container":{"currentBytes":"471859200","limitBytes":"536870912","usageRatio":0.87890625,"oomKillCount":"2","newOomKills":null,"counterReset":false}}
```

Here the selected cgroup uses 450 of 512 MiB (about 88%), while the V8 heap uses 25% of its own limit. Investigate payloads, buffers, concurrency and other cgroup processes as well as retained JavaScript objects. `newOomKills: null` means there is no comparable baseline; it does not mean zero. Counts and container byte integers are decimal strings to preserve kernel integer precision. Node metrics use numeric bytes. `arrayBuffers` is already included in `external`.

Read existing platform logs; no dashboard is required:

```sh
docker logs --follow YOUR_CONTAINER
kubectl logs --follow deployment/YOUR_API --container YOUR_CONTAINER
aws logs tail /ecs/YOUR_API --follow
# GKE: kubectl logs, or Cloud Logging filtered to your workload.
# AKS: kubectl logs, or Container Insights configured for your workload.
```

Your deployment must forward and retain stdout. A JSON line does not automatically create a metric or cloud alert. Configure those in your existing observability platform.

### Use your own logger and policy

```js
const memory = await startMemoryWatch({
  log(event) {
    logger.info(event, 'memory-watch'); // e.g. your existing structured logger
    if (event.event === 'memory_status' && event.underPressure) {
      // Application policy: reduce OPTIONAL job admission or batch concurrency.
    }
  },
});
```

The library does not reject requests, change limits, free objects or guarantee prevention. Choose and test your response under representative load. Log callbacks should be fast; synchronous work delays sampling. Async callbacks own their backpressure/queue. Callback errors are absorbed and counted in `memory.state.loggerErrors`; collection continues. No unbounded internal log queue is created.

## How do I get the report?

```js
import { startMemoryWatch, writeDiagnosticReport } from 'container-memory-watch';

const memory = await startMemoryWatch();
const report = memory.report(); // JSON-safe snapshot; no HTML and no automatic files.
if (report) {
  console.log(JSON.stringify({ event: 'memory_report', report }));
  // Optional: an existing, writable directory; save during normal operation.
  await writeDiagnosticReport('/var/reports/memory.json', report);
}
await memory.stop();
```

A report contains the retained time window and timeline. In `cgroup-v2` mode it also contains container evidence, OOM counter deltas, findings and suggested investigation actions. In `node-only` mode it contains Node/V8 evidence and explicit limitations, without fabricated container values. Branch on `report.mode` before reading container-specific fields. An already-aborted startup has no samples and returns `null` from `report()`.

The log is a compact current status; the report is the bounded history. Call `report()` from your own protected diagnostics endpoint, periodic export or incident handler. It creates a copied JSON object, does not upload data, and does not write files. You choose any dashboard, HTML page, storage or alerting integration. Persist evidence before an incident: SIGKILL cannot run a final export, and the library cannot observe after its Node caller dies. A same-cgroup OOM counter does not identify the killed PID.

### Lifecycle and optional tuning

```js
const controller = new AbortController();
const memory = await startMemoryWatch({ signal: controller.signal });
// In your existing graceful shutdown routine:
controller.abort();
await memory.stop(); // Safe to call repeatedly. Retained reports remain readable.
```

The library installs no process signal handlers. Node-only waiting timers do not hold an otherwise idle process open; the persistent Rust child does, so always stop monitoring during graceful shutdown.

| Option | Default | Meaning |
| --- | --- | --- |
| `intervalMs` | `5000` | Delay after each completed sample; minimum 1000 ms, no overlapping sampling |
| `logEvery` | `6` | Emit every N samples, plus detected changes; 1–10,000 |
| `capacity` | `120` | Maximum retained samples; 1–10,000 |
| `threshold` | `0.8` | Container and V8 warning ratio; `(0, 1]` |
| `timeoutMs` | `2000` | Collector response/close timeout |
| `log` | JSON line to `console.log` | Your structured logging callback |
| `signal` | none | Optional cancellation tied to your application lifecycle |

`memory.state.available` means live container evidence is available, not merely that Node sampling runs. It becomes false on collection failure or stop. State getters return copies. Rapid allocations can outrun the sampling interval; unlimited or hidden ancestor limits need separate investigation.

## Read the result and choose a response

- `CONTAINER_MEMORY_PRESSURE`: inspect concurrency, large payloads, batch sizes and container headroom. Heap pressure need not be present.
- `V8_HEAP_PRESSURE`: investigate retained objects with a profiler in an environment with sufficient memory.
- `CGROUP_OOM_KILLS_OBSERVED`: correlate event timestamps with the killed container or process; the counter alone does not identify the victim.
- No finding: no configured threshold was met in the retained samples. This is not a guarantee that a spike, leak or ancestor restriction is absent.

Verify improvement with the same traffic and limits: compare pressure frequency, latency, throughput and observed restarts before and after your application change. Increasing a heap limit can consume container headroom; do not treat it as a universal fix.

## API

| Function | Behavior |
| --- | --- |
| `startMemoryWatch(options?)` | One-call JSON logs, bounded reports, automatic lookup and explicit Node-only fallback |
| `collectMemory(options)` | One-shot Rust collection plus metrics from the calling Node process |
| `createMemoryObserver(options)` | Persistent collector with `sample(): Promise<MemorySample>` and `close(): Promise<void>` |
| `analyzeMemory(current, previous?, threshold?)` | Pressure ratio and counter delta; first observation/reset is unknown |
| `createMemoryRecorder({ capacity? })` | Bounded copied history; capacity defaults to 120, maximum 10,000 |
| `createDiagnosticReport(samples, options?)` | JSON-safe evidence, timeline, findings, actions and limitations |
| `writeDiagnosticReport(path, report)` | Explicit atomic replacement of a local report file |

Collector options require `binaryPath` and `cgroupPath`; `timeoutMs` defaults to 2,000. The persistent API allows one pending request and rejects overlap. Timeouts, malformed protocol data and collector failures terminate the observer; create a new instance for recovery. Always await `close()` during normal shutdown.

Low-level samples use `bigint` for kernel integers. Reports encode those integers as decimal strings and use schema version 1. Use `heap_size_limit`, not `heapTotal`, to interpret V8 headroom. `arrayBuffers` is included in Node's `external`; do not add them together.

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


## Supply-chain verification and runtime permissions

Runtime: bounded memory/cgroup observation, optional explicitly selected Rust collector subprocess, and local report storage. The collector is source-only and built explicitly; installation does not download or execute a native binary. Logs and exports can include diagnostic paths/process metadata; the application controls destinations, retention and permissions.

Install the exact version required by your application and commit your lockfile. Releases request npm provenance from GitHub Actions, and CI checks the dependency graph and package contents before publication. The artifact guard rejects recognized credential patterns, private/environment files, unsafe paths, missing attribution/metadata and unexpected consumer install hooks. It is a focused release check, not proof that every secret or malicious behavior is detectable.

```sh
npm install --save-exact container-memory-watch@0.2.1
npm audit
npm audit signatures
```

When the installed graph has no registry dependencies, npm may report that there are no dependency signatures to verify.

Inspect the exact-version [Socket report](https://socket.dev/npm/package/container-memory-watch/overview/0.2.1) and the npm provenance link. A successful CI check is not the same as a package score of 100. Socket also weighs dependency counts and real adoption; no score, download history or security guarantee is fabricated. Report suspected issues through SECURITY.md.
