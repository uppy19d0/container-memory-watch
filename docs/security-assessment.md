# Release security assessment

Assessment date: October 11, 2026. Candidate version: 0.1.0. This is evidence for a release candidate, not a certification or guarantee of 100% security.

## Completed checks

| Check | Observed result | Scope |
| --- | --- | --- |
| npm dependency audit | Zero known vulnerabilities | Locked development dependencies; no runtime npm dependencies |
| Semgrep Community Edition 1.180.0 | Zero findings and zero scan errors | `p/security-audit` and `p/javascript`; 90 applicable rules, 52 targets |
| Rust checks | Nine tests passed; Clippy warnings denied; formatting and release build passed | Rust model, cgroup evidence and persistent observer |
| Node checks | Seventeen tests passed | SDK, protocol, persistence and actual Rust integration |
| TypeScript contract | Passed | Source and isolated tarball consumer compilation |
| Package allowlist | Passed; 24 files | Source, declarations, package documentation, MIT license and bundled Rust source |
| Installation and collector build | Passed offline without install scripts | Exact tarball installed into an isolated consumer; bundled Rust built and sampled fixtures |
| Credential hygiene | No matches in reviewed source | Basic npm/GitHub/AWS/private-key patterns; not exhaustive secret detection |
| Runtime dependency footprint | Zero third-party npm or Rust runtime dependencies | Does not include tooling needed for development and scanning |

## Hardening applied

Cgroup file reads are capped at 64 KiB before parsing, avoiding unbounded input allocation from a misconfigured path. Persistent protocol requests and responses are bounded, one request is admitted at a time, timeouts terminate stalled collectors and explicit shutdown handles pending work. The SDK does not invoke a shell, automatically download binaries, execute install hooks or upload diagnostics.

Package contents are allowlisted, generated collector copies are compared against repository sources, and release artifacts are checksummed. Rust source is shipped instead of unverified platform binaries. Lockfiles and an exact Rust toolchain are recorded. CI actions are pinned to immutable commits, permissions are read-only outside the OIDC publication job, checkout credentials are not persisted, and dependency updates are configured through Dependabot.

## Evidence location

The reviewed tarball, SHA256SUMS, production CycloneDX SBOM, pack manifest, npm audit JSON and Semgrep JSON are under local ignored `artifacts/`. They are not committed as production telemetry or falsely represented as signed attestations. A SHA-256 checksum identifies content but is not an authenticated signature.

## Remaining gaps

Snyk was not run: separate authentication is unavailable. The user requested an account-free alternative. Semgrep's selected rules primarily assess JavaScript/TypeScript and supported generic patterns; they do not constitute a comprehensive Rust security audit. Clippy and Rust's unsafe-code prohibition are not replacements for such an audit.

Linux OOM behavior, container PID attribution, effective ancestor-limit handling, total process-tree overhead and independent postmortem survival remain unvalidated. Repository branch protection, environment reviewers, npm OIDC configuration and signed provenance must be checked remotely after setup; adding workflow files does not enable those settings.

Registry Semgrep packs can change; results refer to this run and scanner version. Zero findings does not establish that all vulnerabilities are absent. Dependency audit results are time-specific and should be rerun for releases.

The credential used for npm authentication was not written into project source or package files. Credentials shared outside secret storage should be rotated; future releases should use trusted publishing rather than reusable tokens.
