# Library release setup and Socket verification

The repository corrections are merged. Publication of the other libraries remains pending npm Trusted Publishing configuration by the package owner. Source checks do not update previously published, immutable npm versions or guarantee a Socket score of 100.

## Configure npm Trusted Publishing

Sign into npm as **luisaneuris60**. Open each package's Settings, select Trusted Publisher, and choose GitHub Actions. Enter **uppy19d0** as the GitHub organization or user. This field identifies the GitHub owner, not the npm username.

Use the exact repository, workflow filename, and environment below. Leave the environment field empty where shown as “blank”. If the interface offers allowed actions, enable direct **npm publish**; these workflows do not use staged publication. No npm access token is needed for the configured OIDC release.

| npm package | GitHub repository | Workflow filename | Environment | Prepared version |
| --- | --- | --- | --- | --- |
| sillar-ui | sillar-ui | publish.yml | blank | 1.2.1 |
| sillar-cli | sillar-ui | publish-cli.yml | blank | 0.1.1 |
| sillar-data-grid | sillar-data-grid | release.yml | npm | 0.1.1 |
| sillar-toast | sillar-toast | publish.yml | npm | 1.0.1 |
| dominican-republic-map | library-dominican-republic-map | publish.yml | blank | 1.2.1 |
| dominican-republic-geodata | dominican-republic-geodata | publish.yml | blank | 0.2.1 |
| migration-guard-core | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| drizzle-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| knex-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| mikro-orm-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| node-orm-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| prisma-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| sequelize-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| typeorm-migration-guard | node-orm-migration-guards | publish.yml | npm | 0.3.0 |
| pii-safe-logger | pii-safe-logger | publish.yml | npm | 1.3.1 |
| oom-watch | oom-watch | publish.yml | npm-release | 0.1.0 pending first publication |

Configure all eight ORM packages individually before enabling the suite release. The suite's conservative version check requires a minor release for runtime entrypoint changes; the ReDoS correction therefore uses 0.3.0 despite preserving the public API. Consumers pinned to `^0.2.x` must explicitly upgrade.

The legacy name `react-dominican-republic-map` currently has no installable registry versions or dist-tags. Do not assign it an invented release configuration; the active source publishes `dominican-republic-map`.

## Release after configuration

For `node-orm-migration-guards` and `pii-safe-logger`, set the GitHub Actions repository variable `NPM_TRUSTED_PUBLISHING_ENABLED` to `true` only after completing the corresponding npm settings. Then run the `publish.yml` workflow against the verified `main` commit. Enabling the variable also permits automatic publication following successful main CI.

The remaining libraries use version tags: `v1.2.1` for sillar-ui and the map, `cli-v0.1.1` for sillar-cli, `v0.1.1` for the grid, `v1.0.1` for toast, and `v0.2.1` for geodata. Create tags only on the verified release commits. The earlier scoped package `@luisaneuris60/oom-watch@0.1.0` is already published. The requested unscoped name `oom-watch` is a distinct npm package and needs a first publication before its trusted publisher can be configured.

After publication, verify each registry version, provenance attestation, tarball contents, and installation. Review Socket's report for that exact version. Its GitHub dependency check can report “no new dependency alerts” or skip a change without dependency modifications; neither result establishes that the published package has no existing alerts.

## Evidence and limits

The reviews corrected a vulnerable source-map-js build dependency, Sillar CLI symlink writes, ambiguous ORM regular expressions, and release workflow permissions. The seven existing-library repositories passed 118 Node tests in total. Their dependency audits reported zero known vulnerabilities at review time. Detailed scope, tests, and limitations are recorded in each repository's `SECURITY_REVIEW.md`; OOM Watch's review is in its root report and [security assessment](security-assessment.md).

Socket scores also depend on adoption, maturity, package contents, and detected behavior. Correct risks and supply-chain controls directly; do not add downloads, suppress legitimate alerts, or promise a score before the new versions are scanned.

References: [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/), [Socket package scores](https://docs.socket.dev/docs/package-scores), [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), and [CodeQL polynomial ReDoS query](https://codeql.github.com/codeql-query-help/javascript/js-polynomial-redos/).
