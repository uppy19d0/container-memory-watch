# Changelog

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
