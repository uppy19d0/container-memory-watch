# Socket and library release review — 2026-10-11

## What was verified

Fresh dependency audits of sillar-ui, sillar-data-grid, sillar-toast, library-dominican-republic-map, dominican-republic-geodata, node-orm-migration-guards and pii-safe-logger reported **zero known vulnerabilities** across their installed dependency graphs. Their GitHub CodeQL APIs reported **zero open alerts** on main at the time of review. This is time-specific evidence, not proof of the absence of every vulnerability.

Corrections include the source-map-js build dependency update, CLI symlink-write protections, linear ORM identifier parsing, six fixed ReDoS alerts, locked dependency graphs, pinned Actions, scoped workflow permissions, signature checks, explicit packaging review and provenance-capable release workflows. Each source repository contains `SECURITY_REVIEW.md` with scope and limitations.

Socket's GitHub checks generated project reports and accepted the reviewed PRs. Dependency alert checks can skip source-only changes; “success” does not imply there are no existing package alerts. The maintainer profile's historical scores have not been independently refreshed through an authenticated full Socket package report. No score of 100 is claimed.

## Verified public releases

All versions below were subsequently readable in the public npm registry with provenance attestations on 2026-10-11. Initial registry 404s during processing were not treated as successful public releases. Temporary bootstrap secrets were removed from all six repositories and from the memory-watch repository after publishing. Optional token inputs remain disabled by default; ongoing automatic publication should use npm Trusted Publishing.

| Package | Verified version |
| --- | --- |
| `container-memory-watch` | 0.1.1 |
| `dominican-republic-map` | 1.3.0 |
| `dominican-republic-geodata` | 0.2.1 |
| `sillar-ui` | 1.2.1 |
| `sillar-cli` | 0.1.1 |
| `sillar-data-grid` | 0.1.1 |
| `sillar-toast` | 1.0.1 |
| `pii-safe-logger` | 1.3.1 |
| `migration-guard-core` | 0.3.0 |
| `drizzle-migration-guard` | 0.3.0 |
| `knex-migration-guard` | 0.3.0 |
| `mikro-orm-migration-guard` | 0.3.0 |
| `node-orm-migration-guard` | 0.3.0 |
| `prisma-migration-guard` | 0.3.0 |
| `sequelize-migration-guard` | 0.3.0 |
| `typeorm-migration-guard` | 0.3.0 |

The map release includes 154 municipal geometries from a licensed 2020 snapshot. Baitoa, Matanzas, Oviedo and San Víctor have no matched geometry and are explicitly reported instead of displaying fabricated boundaries. This is not a complete current legal municipal boundary dataset.

Existing npm versions are immutable; applications must upgrade to receive the corrections. In particular, consumers using `^0.2.0` of the migration packages must deliberately upgrade to `0.3.0`. Historical Socket rows for a deleted scoped package or legacy map name do not represent these new releases. Review Socket's exact-version alerts after its next scan before reporting score changes.

## What cannot honestly be promised

Socket's supply-chain score incorporates detected behavior and package characteristics such as maturity and adoption. No finite scan establishes “100% secure”. The Rust SDK intentionally runs an explicit trusted collector process and reads local cgroup files; these legitimate capabilities should be documented and inspected, not disguised to influence a behavioral score. Municipal geometry has its own CC BY 4.0 attribution alongside MIT code; retain the notice and inspect licensing signals after publication.

Next actions should be tied to specific alerts with affected package/version, detection type, actual code path, proposed fix and rescan evidence. Public score screenshots alone do not establish which code correction will change the score. See [Socket package score documentation](https://docs.socket.dev/docs/package-scores).

## Maintainer-supplied score baseline

The following snapshot was supplied by the maintainer on 2026-10-11 for [their Socket profile](https://socket.dev/npm/user/luisaneuris60). Package versions were not included and these values have not been independently refreshed. Every listed package had vulnerability and license scores of 100. A vulnerability score is not a guarantee of complete security.

| Package | Supply chain | Quality | Maintenance |
| --- | ---: | ---: | ---: |
| `dominican-republic-geodata` | 78 | 93 | 90 |
| `dominican-republic-map` | 75 | 100 | 91 |
| `drizzle-migration-guard` | 72 | 85 | 88 |
| `knex-migration-guard` | 72 | 83 | 88 |
| `@luisaneuris60/oom-watch` | 73 | 95 | 88 |
| `migration-guard-core` | 75 | 95 | 88 |
| `mikro-orm-migration-guard` | 70 | 77 | 88 |
| `node-orm-migration-guard` | 75 | 99 | 87 |
| `pii-safe-logger` | 76 | 100 | 90 |
| `prisma-migration-guard` | 71 | 81 | 88 |
| `react-dominican-republic-map` | 75 | 100 | 86 |
| `sequelize-migration-guard` | 71 | 81 | 88 |
| `sillar-cli` | 74 | 73 | 86 |
| `sillar-data-grid` | 72 | 100 | 86 |
| `sillar-toast` | 74 | 100 | 86 |
| `sillar-ui` | 79 | 100 | 92 |
| `typeorm-migration-guard` | 70 | 82 | 88 |

The legacy `@luisaneuris60/oom-watch` row does not establish a score for its replacement, `container-memory-watch`. The `react-dominican-republic-map` row similarly must not be conflated with the canonical `dominican-republic-map` release. Compare the exact newly published version and its individual alerts before reporting any score improvement.
