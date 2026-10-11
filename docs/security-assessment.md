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

Linux OOM behavior, container PID attribution, effective ancestor-limit handling, total process-tree overhead and independent postmortem survival remain unvalidated. Main branch protection and npm provenance have been verified remotely (see published release evidence below). Environment reviewer protection and npm trusted publisher configuration remain pending; adding workflow files does not enable those settings.

Registry Semgrep packs can change; results refer to this run and scanner version. Zero findings does not establish that all vulnerabilities are absent. Dependency audit results are time-specific and should be rerun for releases.

The credential used for npm authentication was not written into project source or package files. Credentials shared outside secret storage should be rotated; future releases should use trusted publishing rather than reusable tokens.

## Public repository results

The initial GitHub Linux test workflow and Semgrep source-security workflow completed successfully after upload. OpenSSF Scorecard 5.5.0 returned an initial aggregate score of **5.7/10** for the first source commit. This is the actual result, not 100%. License, security policy, token permissions, dangerous-workflow, binary-artifact, dependency-update and vulnerability checks scored 10/10. The new repository lacks review history, maintenance history, fuzzing, protected branches and signed releases. Some checks were unavailable because no pull requests or releases existed.

A pinned CodeQL workflow has been added for JavaScript/TypeScript, Rust and GitHub Actions with the security-extended suite. Its completed results must be checked before claiming a clean CodeQL scan. The earlier Semgrep clean result does not establish Rust-specific analysis coverage.

## Hardening follow-up

OpenSSF Scorecard increased to **6.6/10** after protected main, complete action pinning, removal of the global npm installation and CodeQL detection. Private vulnerability reporting, secret scanning/push protection, Dependabot alerts and automated security-fix PRs are enabled. Main blocks force pushes and deletion and requires passing test and Semgrep checks, including for administrators. Independent code review, mature maintenance history, fuzzing and signed releases remain gaps; they cannot be invented to obtain 100%. The initial npm release used `@luisaneuris60/oom-watch`. npm rejected the unscoped name `oom-watch` as too similar to `npm-watch`. The prepared release name is now `container-memory-watch`, pending its first publication.


## Published release evidence

`@luisaneuris60/oom-watch@0.1.0` was published publicly from commit `2d2f9bb61c65d7b32bd4b03c03bfa0baede473e8` by [GitHub Actions run 38119376962](https://github.com/uppy19d0/container-memory-watch/actions/runs/38119376962). The run passed Rust, Node, TypeScript, npm audit, Semgrep and package inspection checks before publication. The temporary encrypted npm authentication secret was deleted after the run; reusable registry credentials are not included in the source or package.

A fresh consumer installed the package by its npm name with lifecycle scripts disabled. `npm audit signatures` reported **one verified registry signature and one verified attestation**. The downloaded registry tarball matched the CI SHA-256 exactly:

```
9b277bc7ce3f1ab84ac01aa25ad1cb019ac4226cba24d0c28af2a54fef29df55
```

The [main CodeQL run](https://github.com/uppy19d0/container-memory-watch/actions/runs/38119357681) completed successfully for Rust, JavaScript/TypeScript and GitHub Actions. The API reported zero open code-scanning alerts after the test fixture stopped embedding response data in generated code.

OpenSSF Scorecard 5.5.0 returned **6.7/10** after publication and the legitimate release pull request. The CI-Tests check now scores 10/10. Review history, mature maintenance history, fuzzing, stronger branch review protection and a best-practices badge remain gaps. Scorecard's Packaging and Signed-Releases checks were unavailable in this run; npm's independently verified attestation does not mean those checks scored 10/10. This assessment is not a Snyk result or a 100% security certification.

Package: [npm release](https://www.npmjs.com/package/@luisaneuris60/oom-watch). For future credential-free publication, the npm owner still needs to configure the trusted publisher described in [release process](release-process.md).


## Requested scanner clarification

Socket is the user's requested package-review service. The OpenSSF scores above remain accurate repository assessments, but they are not Socket package scores. See the [Socket review](../SECURITY_REVIEW.md) for verified release controls, necessary collector capabilities and the limitation on retrieving public Socket package metrics.
