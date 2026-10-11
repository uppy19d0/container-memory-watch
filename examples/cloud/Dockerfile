# Build from the repository root. Resolve tags to approved digests in your CI.
FROM rust:1.99.0-bookworm AS collector
WORKDIR /build
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src ./src
COPY tests ./tests
RUN cargo build --release --locked

FROM node:24.21.0-bookworm-slim
WORKDIR /app
COPY --from=collector /build/target/release/oom-watch /opt/oom-watch/oom-watch
COPY packages/node /app/packages/node
COPY examples/cloud/server.mjs examples/cloud/memory-monitor.mjs /app/examples/cloud/
ENV NODE_ENV=production PORT=3000 OOM_WATCH_BINARY=/opt/oom-watch/oom-watch OOM_WATCH_CGROUP_PATH=/sys/fs/cgroup
USER node
EXPOSE 3000
CMD ["node", "examples/cloud/server.mjs"]
