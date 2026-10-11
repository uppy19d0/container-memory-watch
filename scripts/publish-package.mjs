import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
  throw new Error('Publication requires GitHub Actions OIDC for verifiable provenance');
}
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sdk = join(root, 'packages/node');
const temporary = process.env.RUNNER_TEMP;
if (!temporary) throw new Error('Missing CI temporary directory');
const npmCli = process.env.npm_execpath ?? resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
const packed = spawnSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: sdk, encoding: 'utf8' });
if (packed.status !== 0) throw new Error('npm pack failed');
const metadata = JSON.parse(packed.stdout)[0];
if (typeof metadata.filename !== 'string' || !/^[a-z0-9.-]+\.tgz$/.test(metadata.filename)) throw new Error('Unexpected package filename');
const tarball = join(temporary, metadata.filename);
const sha256 = createHash('sha256').update(await readFile(tarball)).digest('hex');
await writeFile(join(temporary, 'oom-watch-package-manifest.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(join(temporary, 'oom-watch-SHA256SUMS'), `${sha256}  ${metadata.filename}\n`);
console.log(`Publishing inspected tarball ${metadata.filename}; SHA-256 ${sha256}`);
const published = spawnSync(process.execPath, [npmCli, 'publish', tarball, '--provenance', '--access', 'public', '--ignore-scripts', '--registry', 'https://registry.npmjs.org/'], { cwd: sdk, stdio: 'inherit' });
if (published.status !== 0) process.exitCode = published.status ?? 1;
