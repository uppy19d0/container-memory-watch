# Release process and supply-chain evidence

The public source repository is https://github.com/uppy19d0/container-memory-watch. Package metadata must match it. The requested npm name is `container-memory-watch`; npm rejected `oom-watch` as too similar to `npm-watch`. The earlier `@luisaneuris60/oom-watch@0.1.0` publication remains historical evidence, not proof of an unscoped release. npm releases are immutable: validate the exact tarball before publishing.

## Required checks

Run CI tests, TypeScript consumer compilation, formatting, Clippy, dependency audit, source scanning and package hygiene checks. Preserve lockfiles, pin action commits, and update pinned tooling through reviewed changes. Run `npm run prepare:package --prefix packages/node` before packing; it copies reviewed Rust source and policies into the SDK. `node scripts/check-release.mjs` rejects unexpected artifact paths, stale source copies, install lifecycle hooks and recognizable credential patterns. It is a local hygiene check, not a complete secret detector.

The npm package intentionally ships Rust source and requires an explicit build. No installation scripts, executable downloads, runtime npm dependencies or third-party Rust dependencies are required. Generated binaries, diagnostic artifacts, development dependencies, credentials and machine-specific files must not enter the source commit or npm tarball.

## Provenance and trusted publishing

Preferred releases run `publish.yml` through GitHub Actions using npm trusted publishing (OIDC), with provenance. Configure npm's trusted publisher for owner `uppy19d0`, repository `container-memory-watch`, workflow `publish.yml`, and environment `npm-release`. Configure that GitHub environment's reviewer protection before production release. These remote settings are not established merely by adding a workflow file.

Current npm docs require a public matching repository and supported CI environment for provenance. The local npm token is not a substitute for verified build provenance. Normal releases use OIDC. The first release can use the explicit bootstrap input with an encrypted temporary NPM_BOOTSTRAP_TOKEN secret, exposed only to the publish step and removed after the run. Source: https://docs.npmjs.com/generating-provenance-statements/ and https://docs.npmjs.com/trusted-publishers/.

A token-authorized bootstrap publication from the public GitHub Actions workflow can establish the package before trusted publishing is configured and can generate npm provenance using GitHub OIDC. The publication script requires GitHub Actions OIDC and publishes the exact inspected tarball. A local bootstrap would lack that provenance and must not claim it. Rotate tokens shared outside their intended secret storage, and prefer OIDC for later releases.

## Security scanners

Snyk requires separate authentication and appropriate organization features. No Snyk result is claimed without a completed authenticated scan. Account-free alternatives include npm audit for dependency advisories and Semgrep Community Edition for supported source patterns. Registry rules can change independently; record scanner version and the actual rule set/run output. These checks assess different risks and do not produce a universal 100% supply-chain score.

OpenSSF Scorecard additionally assesses repository settings and development history, including branch protection, reviews, signed releases and permissions. Some checks cannot be satisfied by documentation or a brand-new local package. A score must refer to an actual repository scan. Source: https://github.com/ossf/scorecard/blob/main/docs/checks.md.

## Artifact inspection

Generate npm pack metadata, a SHA-256 checksum, a production CycloneDX SBOM, and dependency/source scan evidence under ignored `artifacts/`. Review tarball contents and install the exact tarball into an isolated consumer without install scripts. Check ESM imports, TypeScript declarations and bundled collector builds. Record which operating systems were actually tested.

Before upload, inspect Git's staged paths, whitespace checks and credential-pattern checks. Add files explicitly rather than including ignored output. Never overwrite remote history or claim that configured workflows have already passed.

The Node release used in CI is pinned to 24.21.0 with bundled npm 11.19.0. Publication does not install a separate global npm CLI. This removes an extra tool download and avoids the un-hashed npm install flagged by the initial Scorecard run. Updates to the Node release should be reviewed together with npm compatibility.
