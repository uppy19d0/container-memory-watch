# Security policy

## Supported versions

Version 0.1.x is experimental. Security fixes are applied to the latest 0.1.x release; older releases should be upgraded. This project has not completed an independent security audit and does not guarantee survival during OOM.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting channel for this repository when available: https://github.com/uppy19d0/oom-watch/security/advisories/new. If the private channel is unavailable, contact the maintainer through their GitHub profile to request a private reporting route. Do not post exploit details, production diagnostics, credentials or tokens in a public issue.

Include the affected version, minimal reproduction, expected behavior and impact. Response times depend on maintainer availability; no response SLA is promised. Coordinate disclosure after a fix and advisory are ready.

## Trust boundaries

The application chooses the collector executable, cgroup directory and report destination. Only run a collector you built from reviewed source or verified against release provenance. This SDK does not download or execute a collector during installation. Paths and application code are trusted operator inputs, not a sandbox for untrusted tenants.

The collector is read-only and requires no Docker socket or Kubernetes credentials. It bounds cgroup-file reads and transport frames. The SDK permits one pending request, times out stalled collection, and stores bounded history. Reports contain memory metrics and caller-supplied termination reasons; they are not heap dumps. Export is explicit with owner-only permissions on POSIX, but storage administrators and directory access remain outside SDK control.

Counter changes do not identify a killed PID. Caller-supplied termination evidence is not identity-verified. Persistent transport stops on input EOF and is not independent postmortem observation.

## Dependency and release policy

Runtime npm and third-party Rust dependencies are absent in this version. Development dependencies are locked; CI installs them without install scripts. GitHub Actions are pinned to commits, workflow permissions are explicit, and publishing is separated from pull-request checks. Releases require tests, package inspection and scanner evidence. A clean dependency scan does not prove absence of source vulnerabilities.

If a credential is exposed, rotate it through the service that issued it. Never include credentials in Git, package artifacts, diagnostic files or scan reports.
