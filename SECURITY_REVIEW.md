# Socket review

Assessment date: October 11, 2026.

Socket is the requested package-review service. The previously reported OpenSSF Scorecard result of 6.7/10 is a repository assessment and must not be presented as a Socket supply-chain package score.

The user supplied [Socket maintainer profile](https://socket.dev/npm/user/luisaneuris60). Direct package pages deny automated retrieval in this environment. A refreshed package score or complete Socket alert inventory has not been obtained. GitHub's Socket integration passed the release pull request checks; that is not equivalent to every published-package metric being 100%.

`@luisaneuris60/oom-watch@0.1.0` has verified npm registry signatures and a verified provenance attestation. It has zero third-party runtime dependencies, ships reviewed Rust source, has no automatic install scripts or binary downloads, bounds cgroup/protocol inputs, and isolates the persistent collector behind a narrow SDK protocol. See [release evidence](docs/security-assessment.md).

The SDK intentionally launches a caller-selected collector executable; the collector reads caller-selected cgroup files, and explicit report storage writes local files. A Socket signal for subprocess, native code or filesystem access should be assessed against those documented capabilities. Hiding them or suppressing alerts would not improve the security of the implementation.

[Socket's scoring documentation](https://docs.socket.dev/docs/package-scores) includes adoption, dependency counts and other project signals. Package scores must be read from Socket after analysis; tests, npm audit and OpenSSF scores do not establish that score. Production Linux OOM behavior and independent postmortem survival remain unvalidated.
