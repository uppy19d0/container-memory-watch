# Decision: Rust core with a JavaScript/TypeScript SDK

Status: accepted for the prototype; performance and deployment suitability still require measurements.

Rust is technically capable of Linux memory collection, external observation and integration with Node. Its ownership system supports memory safety without a tracing garbage collector. This is useful for a monitor operating under memory pressure. It does not prevent every allocation failure, memory leak or excessive resource consumption. Source: https://rust-lang.org/

| Candidate | Relevant strength | Tradeoff for this project |
| --- | --- | --- |
| Rust | Explicit resource ownership, native binary, no required tracing GC | Learning curve, compile time, target-specific builds; careful API design required |
| TypeScript/Node | Familiar application integration and rapid iteration | A monitor inside the target shares its failure lifecycle; Node runtime overhead needs measurement |
| Go | Native deployment and a mature concurrency model | Garbage collector adds resource-management considerations; its memory limit is soft, not an OOM survival guarantee |

Node can also run as a separate observer. Process isolation is an architectural choice, not a feature exclusive to Rust. Go's GC tradeoffs are documented at https://go.dev/doc/gc-guide; Node subprocess APIs at https://nodejs.org/api/child_process.html.

Recommendation: retain Rust for the collector and offer a small typed SDK for application users. Prefer team familiarity over theoretical speed if Rust maintenance becomes a bottleneck. There is no evidence yet that Rust is universally the best language or faster for this particular workload.

Before committing to production, compare Rust and a minimal Node collector under the same Linux cgroup and sampling intervals. Measure CPU time, peak RSS, latency percentiles, missed events and packaging effort. Separate process-start cost from file parsing. Publish raw results and workload details; choose a persistent subprocess or native addon only when measured needs justify it.
