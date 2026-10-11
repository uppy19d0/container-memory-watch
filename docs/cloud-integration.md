# Integrate memory diagnostics into cloud containers

Run the SDK **inside the Node process you want to measure**. It samples that process's Node/V8 metrics and the explicitly selected cgroup. A sidecar importing the SDK would measure its own Node process; this version is not a fleet agent or independent postmortem daemon.

The [application monitor](../examples/cloud/memory-monitor.mjs) uses sequential five-second sampling, one persistent Rust collector, a 120-sample window, structured JSON logs approximately every 30 seconds and on pressure transitions, cancellation, and bounded request timeouts. Copy it into your application and change its import to `container-memory-watch` after the 0.1.0 staged release is approved. The [sample API](../examples/cloud/server.mjs) demonstrates an optional-work admission policy while keeping health requests independent.

## Prerequisites and observable limits

Use Linux cgroup v2 with readable `memory.current`, `memory.max` and `memory.events` for the intended container. Validate **from inside the deployed container**:

```sh
cat /proc/self/cgroup
cat /sys/fs/cgroup/memory.current
cat /sys/fs/cgroup/memory.max
cat /sys/fs/cgroup/memory.events
```

In a container with an appropriate private cgroup namespace, `/sys/fs/cgroup` may expose its root. Other runtimes expose a broader hierarchy or different paths. Select the actual cgroup; do not mount the host root and silently treat host/task-wide memory as application memory. A visible `max` can still have a restricted ancestor, which the SDK does not resolve. Missing files mean unsupported collection, not zero pressure. The example logs unavailability and keeps the API running. A later collector failure stops monitoring and logs it; define operator recovery rather than treating stale values as current evidence.

These provider configurations are examples, **not verified cloud deployments**. Resource values demonstrate syntax and require workload measurement. GKE/AKS support depends on the node/runtime configuration; ECS EC2 depends on your host configuration. Fargate, Cloud Run and Azure Container Apps are conditional environments: verify their actual exposed memory files and scope before relying on this SDK.

## Build once, run without Rust or installation hooks

Build from the repository root using [the multi-stage Dockerfile](../examples/cloud/Dockerfile):

```sh
docker build -f examples/cloud/Dockerfile -t memory-watch-api:local .
docker run --rm --memory=512m --read-only --cap-drop=ALL -p 3000:3000 memory-watch-api:local
```

The demonstration image copies the local SDK source with zero runtime dependencies and compiles Rust in the build stage. Your existing application's image should install its locked npm dependencies with `npm ci --ignore-scripts`, explicitly build the collector from the approved package source for the target architecture, and copy only the runtime files and executable. Compile for the deployment platform; do not copy a macOS executable into Linux. Resolve the example base-image tags to reviewed digests and scan the final image before release. No privileged container, Docker socket, Kubernetes API token or cloud SDK is needed for collection.

## AWS ECS

Use [ecs-task-definition.json](../examples/cloud/ecs-task-definition.json) on an **ECS EC2** cluster whose Linux host and container runtime use cgroup v2. Replace account, region, execution-role and image placeholders, precreate the CloudWatch log group with a retention period, and give the execution role its required image-pull/log permissions. The application itself needs no AWS permissions for memory collection.

```sh
aws ecs register-task-definition --cli-input-json file://examples/cloud/ecs-task-definition.json
```

The example uses a 512 MiB container hard limit, 128 MiB reservation, non-root execution and `awslogs`. Configure networking and the ECS service separately. For **Fargate**, this EC2 task definition is not directly interchangeable: select valid task CPU/memory, platform settings, networking and logging, then validate cgroup readability and scope in the running task. No Fargate compatibility claim is made from an EC2 template.

View `memory_evidence` in CloudWatch Logs. Correlate timestamps with ECS task/container stopped reasons and CloudWatch memory metrics; the SDK does not fetch ECS termination events.

## Kubernetes, GKE and AKS

Use [kubernetes.yaml](../examples/cloud/kubernetes.yaml) on a verified Linux cgroup v2 node pool. Replace the image with your registry digest before applying. The manifest disables API-token mounting, drops capabilities, uses a read-only root, declares requests/limits and keeps liveness independent of memory warnings.

```sh
kubectl apply -f examples/cloud/kubernetes.yaml
kubectl logs deployment/memory-watch-api --all-pods=true --prefix=true
kubectl describe pod YOUR_POD
```

Do not turn a pressure warning into a liveness failure: restart loops can hide evidence and interrupt work. Capture Node logs during normal operation, since SIGKILL cannot trigger a final export. Compare the selected cgroup's visible limit with the container limit in your manifest; namespace identity and ancestor limits matter. Pass verified `OOMKilled` termination metadata to report generation only for a matched container lifecycle.

For **GCP GKE**, push the same image to Artifact Registry and use it in the manifest; configure your logging agent to retain structured stdout. Check the node pool's effective cgroup mode during upgrades. For **Azure AKS**, use an ACR image and the same manifest; configure Azure Monitor/Container Insights log collection and retention. Registry access and log forwarding are cluster responsibilities, not permissions the SDK needs.

## Cloud Run and Azure Container Apps

Do not assume managed services expose the same kernel filesystem as Kubernetes. First validate cgroup v2 files and their scope in the actual deployment. If unavailable, keep the example's monitoring-unavailable signal and use provider memory metrics; this release has no Node-only collector fallback.

On **Cloud Run**, a periodic background sampler requires CPU outside request processing; request-based billing can suspend background work. Instance-based billing changes cost. Minimum instances alone are not a substitute for choosing the appropriate CPU/billing behavior. Prefer structured stdout to accumulating report files: Cloud Run's writable filesystem consumes instance memory. On **Azure Container Apps**, verify the execution environment and configure platform log export; no Container Apps deployment has been validated here.

## Operational process

1. Establish a baseline with fixed traffic, limits and concurrency; verify that monitoring is available and measures the intended workload.
2. Load-test application + collector together. Measure CPU, total container memory, throughput and latency; Rust is not a guarantee of lower end-to-end overhead.
3. Start with an observable threshold such as 80%, then choose headroom using measured bursts. Add deduplicated alerts and a reversible optional-work policy; use concurrency/batch caps rather than unbounded queues.
4. Test graceful SIGTERM and collector failure. Retain logs outside replaceable containers and reset history across lifecycles. Do not rely on an exit handler after OOM.
5. Compare pressure frequency and OOM/restart events after the change. Investigate heap retention, external buffers, process RSS and container consumption separately. Scale or adjust limits only with evidence and a rollback plan.

## References

- [Kubernetes cgroup v2](https://kubernetes.io/docs/concepts/architecture/cgroups/).
- [AWS ECS task definition parameters](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters_ec2.html) and [container security guidance](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/security-tasks-containers.html).
- [GKE migration to cgroup v2](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/migrate-cgroupv2).
- [AKS cgroup v2 memory accounting](https://learn.microsoft.com/en-us/troubleshoot/azure/azure-kubernetes/create-upgrade-delete/aks-increased-memory-usage-cgroup-v2).
- [Cloud Run billing/CPU allocation](https://docs.cloud.google.com/run/docs/configuring/billing-settings) and [development tips](https://docs.cloud.google.com/run/docs/tips/general).
