# Contributing

Keep collection, protocol, analysis and storage in their existing modules. Describe observable behavior, uncertainty and compatibility in each change. Add behavior tests for altered evidence or lifecycle handling; avoid tests that merely mirror implementation.

## Local checks

Use Rust 1.99.0 and Node.js 22 or newer. From the repository root:

```sh
npm ci --prefix packages/node --ignore-scripts
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --locked
OOM_WATCH_BINARY="$PWD/target/debug/oom-watch" npm test --prefix packages/node
npm run typecheck --prefix packages/node
npm run prepare:package --prefix packages/node
node scripts/check-release.mjs
```

Live cgroup tests require Linux. macOS fixture tests cannot validate kernel OOM behavior. Include measured methodology and raw results for performance claims. Do not add production data, credentials, generated binaries or dependency folders. Preserve Cargo.lock and package-lock.json.

Use focused pull requests and conventional descriptive commit messages. Security vulnerabilities belong in the private reporting route described in SECURITY.md. Contributions are made under the project's MIT license.
