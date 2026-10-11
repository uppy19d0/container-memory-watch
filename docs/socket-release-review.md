# Socket and library release review — 2026-10-11

## What was verified

Fresh dependency audits of sillar-ui, sillar-data-grid, sillar-toast, library-dominican-republic-map, dominican-republic-geodata, node-orm-migration-guards and pii-safe-logger reported **zero known vulnerabilities** across their installed dependency graphs. Their GitHub CodeQL APIs reported **zero open alerts** on main at the time of review. This is time-specific evidence, not proof of the absence of every vulnerability.

Corrections include the source-map-js build dependency update, CLI symlink-write protections, linear ORM identifier parsing, six fixed ReDoS alerts, locked dependency graphs, pinned Actions, scoped workflow permissions, signature checks, explicit packaging review and provenance-capable release workflows. Each source repository contains `SECURITY_REVIEW.md` with scope and limitations.

Socket's GitHub checks generated project reports and accepted the reviewed PRs. Dependency alert checks can skip source-only changes; “success” does not imply there are no existing package alerts. The maintainer profile's historical scores have not been independently refreshed through an authenticated full Socket package report. No score of 100 is claimed.

## Remaining release work

The verified operational npm release is `container-memory-watch@0.1.1`, publicly installable with verified registry signatures and provenance (GitHub Actions run `38161734287`). `dominican-republic-map@1.3.0` is also publicly available with provenance; it adds province drill-down with 154 dated municipal geometries and explicitly reports four missing geometries. Other repositories' prepared versions are listed in [trusted publisher setup](library-release-setup.md); merged source corrections alone do not update immutable older npm versions.

Configure each package's npm Trusted Publisher, publish the corresponding verified version, then examine Socket's report for that exact version. If npm stages an upload, approval may require the package maintainer's 2FA. A passing CI upload must be followed by registry checks, not treated alone as public availability.

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
