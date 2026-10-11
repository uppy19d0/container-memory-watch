# Market research and applied product direction

Date: October 11, 2026. Target use case chosen by the project owner: Node.js API containers restarting with Kubernetes `OOMKilled`.

## What is established

OOM monitoring is already served by commercial and open-source products. Merely emitting an OOM alert is not a defensible differentiator. Vendor documentation establishes existing capabilities, not independent proof of buyer demand or product effectiveness.

| Existing option | Documented capability | Implication for OOM Watch |
| --- | --- | --- |
| Datadog OOM Kill integration | eBPF-backed OOM events, including killed and triggering process identifiers | Avoid competing on basic detection; process attribution would require stronger evidence than cgroup counters |
| Inspektor Gadget | Dedicated OOM-kill tracing gadget | Kernel tracing is already available in open source; avoid recreating it without a clear need |
| kube-state-metrics | Pod/container termination-reason metrics from Kubernetes state | Integrate existing termination evidence rather than claim a new monitoring signal |
| Node diagnostic reports | JSON diagnostics on fatal runtime errors, including runtime OOM | Complement built-in diagnostics; they do not provide a guaranteed callback after kernel SIGKILL |

Sources: [Datadog](https://docs.datadoghq.com/integrations/oom-kill/), [Inspektor Gadget](https://inspektor-gadget.io/docs/main/gadgets/trace_oomkill/), [kube-state-metrics metric definitions](https://github.com/kubernetes/kube-state-metrics/blob/main/docs/metrics/workload/pod-metrics.md), [Node diagnostic reports](https://nodejs.org/api/report.html).

## Opportunity hypothesis

Build a small, local-first diagnostic SDK for Node API teams who can see a container restart but lack an accessible explanation of the memory evidence leading up to it. The proposed value is combining container consumption, V8 heap headroom and bounded recent history into a shareable report with uncertainty and concrete next investigation steps.

This is a hypothesis, not validated product-market fit. Existing observability vendors also correlate memory telemetry. Our potential advantages are application-level integration, transparent rules, no mandatory SaaS account and inspectable report output. These advantages must be tested against existing tooling and real team workflows.

## Applied in this iteration

- Collector now reads the V8 heap limit alongside Node process memory and Rust cgroup evidence.
- Diagnostic reports separate container pressure and V8 pressure. They do not label either as a proven leak.
- Caller-supplied Kubernetes termination reason is shown separately from sampled cgroup evidence.
- Bounded recording retains only known numeric metrics, copies caller data and supports lifecycle reset.
- Reports are JSON-safe with decimal strings for large kernel integers, schema version 1 and explicit limitations.
- File export uses explicit atomic replacement and owner-only file permissions on POSIX. Nothing is uploaded automatically.
- Tests cover pressure separation, corrupt samples, counter resets, history bounds, mutation isolation and file replacement.

Node's `heap_size_limit` is the runtime heap limit; `heapTotal` is not an equivalent denominator. Source: [V8 API](https://nodejs.org/api/v8.html#v8getheapstatistics).

## What remains before pilot deployment

1. Collect the correct workload cgroup using mount-aware discovery and ancestor-limit resolution.
2. Add independently running observation and durable history so evidence survives target termination.
3. Associate samples with Kubernetes pod UID, container ID and restart identity; manually supplied termination reasons cannot verify attribution.
4. Run controlled OOM and explicit SIGKILL scenarios in Linux containers. Docker is installed here, but its daemon is unavailable, so these tests have not run.
5. Benchmark CPU, RSS, sampling latency and storage cost; choose a sampling architecture based on results.
6. Exercise the report in an actual Node API and compare its investigative value with existing monitoring.

## Risks and advantages

| Concern | Current advantage | Remaining risk |
| --- | --- | --- |
| Runtime safety | Bounded sample count and no automatic snapshots | SDK allocations and collector process startup can still add pressure |
| Privacy | Explicit local export; known metrics only | File destination and access policy remain the operator's responsibility |
| Diagnosis | Separates observed pressure and termination evidence | Does not establish the request, object or allocator responsible |
| Adoption | Small SDK with no runtime npm dependencies | Rust binary packaging and cgroup configuration still require work |
| Market positioning | Focused Node API workflow | Competition already offers related diagnostics; differentiation is unvalidated |
| Postmortem use | Reports can be written between samples | In-memory history disappears on kill; no independent persistent observer yet |

Atomic replacement reduces partial-file visibility; it does not guarantee survival of a power failure because fsync is not implemented. A retained window can miss earlier events. Records must be reset across workload lifecycles, even if counters do not decrease.

## Validate demand before expanding scope

Use owner-provided incidents and voluntary pilot teams; no outreach has been performed. Ask which telemetry they already use, what was missing during the last OOM incident, how long investigation took, and whether this report changes their next action. Compare the same incident with and without this tool. Track integration effort, correctly interpreted findings, and time to an evidence-supported explanation.

Expand only when pilots demonstrate useful additional evidence. Do not promise automatic root cause, prevention, cost savings or universal portability without measurements. Pricing, market size and willingness to pay are unknown; no estimates are fabricated here.

## Verification results

Twelve Node tests passed, including the actual Rust binary integration. TypeScript consumer compilation passed. The report example ran end to end and produced `examples/sample-report.json` using synthetic cgroup values and the example process's real Node metrics; it is a demonstration, not a captured OOM incident. The existing six Rust regression tests passed in the preceding architecture iteration; Rust code was unchanged in this iteration.
