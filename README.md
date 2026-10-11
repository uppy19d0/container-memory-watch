# Container Memory Watch

A Rust memory-evidence collector and typed Node.js SDK for APIs experiencing container memory pressure. The SDK combines Linux cgroup v2 measurements with Node/V8 metrics, retains bounded history and exports local diagnostic reports with explicit limitations.

**Status:** experimental 0.2.x. Live collection requires Linux cgroup v2. The tool does not automatically identify a memory leak, the responsible request or the killed process. Independent postmortem observation and automatic Kubernetes correlation are not implemented.

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

The npm package name is `container-memory-watch`; the source repository is `container-memory-watch` and the Rust binary remains `oom-watch`. The latest release and provenance are verifiable in npm. See the [SDK guide](packages/node/README.md) for installation and integration.

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


## Evidence and product direction

[Performance research](docs/performance-research.md) compares the persistent Rust path, one-shot Rust and direct Node file reads with reproducible fixture measurements. Results are not production performance guarantees. [Market research](docs/market-research.md) records existing alternatives and the unvalidated opportunity hypothesis.

[Security assessment](docs/security-assessment.md) records completed checks and remaining gaps. [Release process](docs/release-process.md) describes package inspection, provenance, trusted publishing and scanner requirements. No 100% security or supply-chain score is claimed.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CHANGELOG.md](CHANGELOG.md). Licensed under [MIT](LICENSE). Source repository: https://github.com/uppy19d0/container-memory-watch.

## Cloud integration

See the [ECS, Kubernetes, GKE and AKS guide](docs/cloud-integration.md) for a multi-stage image, deployment templates, pressure-aware application hooks, structured logs and an operational validation process. Managed services such as Fargate, Cloud Run and Azure Container Apps require runtime compatibility checks.
