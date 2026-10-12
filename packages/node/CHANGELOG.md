# Changelog

## 0.2.1

- Document package runtime permissions, supply-chain verification and scanner limitations.
- Gate CI/publication on reviewed artifact contents and add regression checks for packaging risks.
- Keep reviewed dependency update automation and preserve existing runtime APIs.


## 0.2.0

- Add `startMemoryWatch()` with immediate JSON logs, sequential sampling and automatic conventional cgroup/collector lookup.
- Provide transparent Node-only monitoring when container evidence is unavailable; unknown container metrics remain null.
- Add bounded on-demand reports, custom log sinks, pressure-transition/OOM logging, AbortSignal and idempotent shutdown.
- Keep existing collector/report APIs compatible and retain zero runtime dependencies and install hooks.
- Document one-call onboarding, report interpretation and cloud log commands in npm and the portfolio.

## 0.1.1

- Clarify package benefits, pressure mitigation hooks and verified release status.
- Document ECS EC2, Kubernetes, GKE and AKS deployments with runtime compatibility checks.
- Add tested monitoring lifecycle examples, structured logs and deployment templates to the source repository.
- Include README links to cloud integration; examples remain source-repository artifacts.

## 0.1.0 — Initial experimental release candidate

- Read-only Rust collector for cgroup v2 consumption, visible limits and OOM counters.
- Persistent request-driven collection with versioned frames, bounded input and explicit flushing.
- Typed Node SDK with one-shot and persistent collection, timeouts and lifecycle handling.
- Bounded history and diagnostic reports that distinguish V8 and container pressure.
- Explicit atomic local report export and POSIX owner-only file permissions.
- Regression, integration and TypeScript contract checks.
- Source-only npm collector distribution; no install scripts or automatic binary downloads.

Known limitations: Linux cgroup v2 only for live collection; explicit cgroup selection; no ancestor-limit discovery, automatic Kubernetes correlation or independent postmortem observer. Local benchmark results are fixture measurements, not production guarantees. See docs/performance-research.md and SECURITY.md.
