# Architecture and growth rules

## Current boundaries

```text
oom-watch/
  src/
    lib.rs                 Public Rust exports
    model.rs               Memory evidence and pure calculations
    cgroup/
      mod.rs               Read-only cgroup v2 filesystem adapter
      parser.rs            Kernel text validation
    protocol.rs            CLI JSON wire format
    observer.rs            Bounded request-driven persistent collection
    main.rs                CLI arguments, output and exit status
  tests/
    regression.rs          Rust public API behavior
  packages/node/
    index.js               Public JavaScript exports
    index.d.ts             Public TypeScript contract
    src/
      collector.js         One-shot subprocess invocation and Node metrics
      observer.js          Persistent transport, framing and lifecycle
      protocol.js          Wire-format validation
      analysis.js          Pure pressure and counter analysis
      report.js            Evidence reports and bounded lifecycle history
      storage.js           Explicit atomic local report export
    index.test.js          Node API and Rust integration tests
  docs/                    Architecture, decisions and research
```

The domain model does not read files or spawn processes. The cgroup adapter returns domain evidence; the CLI serializes it. The Node collector executes the CLI and validates its output; analysis works independently of execution. Public entry points remain stable when internal modules change.

Keep dependencies directed toward the model. Add platform access in adapters, never in model calculations. Treat malformed evidence as errors and missing knowledge as unknown. Preserve integer precision across the Rust/JavaScript boundary. Explain assumptions near the relevant API.

## How the project should grow

1. Add mount-aware cgroup discovery and effective ancestor-limit resolution inside the Linux adapter, with Linux integration fixtures and live tests.
2. The persistent request-driven observer now removes repeated spawn cost. It admits one request at a time, bounds frames and supports shutdown. Independent scheduling and postmortem survival remain separate future work.
3. Add Docker and Kubernetes adapters for identity and termination evidence. Keep their API clients separate from cgroup parsing; grant minimum permissions.
4. Add persistence behind an explicit storage interface when there is a real backend. Bound retention, handle write failures and redact sensitive metadata.
5. Version the wire protocol before independently distributing collector and SDK releases. Add migration and compatibility tests.
6. Split into a Cargo workspace when components need independent dependencies or releases. The current single crate avoids unnecessary release coordination.

Use abstractions when there are concrete implementations to separate. Avoid empty packages, generic service frameworks and speculative plugin systems. Keep tests focused on behavior at boundaries, especially corrupt evidence, identity changes and lifecycle failures.

## Definition of done

A change must document observable behavior and uncertainty, preserve or intentionally version the public API, pass formatting and lint checks, and include behavior tests when it changes collection or analysis. Production claims additionally require Linux workload tests and measured resource overhead. Unit tests alone do not prove deployment safety or scalability.
