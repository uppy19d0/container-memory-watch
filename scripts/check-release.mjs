import { readFile, readdir, lstat, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sdk = join(root, 'packages/node');
const pkg = JSON.parse(await readFile(join(sdk, 'package.json'), 'utf8'));
if (pkg.private || pkg.license !== 'MIT' || !pkg.repository?.url || !pkg.description) throw new Error('Incomplete publication metadata');
if (Object.keys(pkg.dependencies ?? {}).length || Object.keys(pkg.optionalDependencies ?? {}).length) throw new Error('Unexpected runtime dependency');
for (const hook of ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'prepack', 'postpack', 'publish', 'postpublish']) {
  if (pkg.scripts?.[hook]) throw new Error(`Unexpected lifecycle hook: ${hook}`);
}
const npmCli = process.env.npm_execpath ?? resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js');
const cache = await mkdtemp(join(tmpdir(), 'oom-watch-pack-cache-'));
let packed;
try {
  packed = spawnSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: sdk, encoding: 'utf8', env: { ...process.env, npm_config_cache: cache } });
} finally { await rm(cache, { recursive: true, force: true }); }
if (packed.status !== 0) throw new Error(`Package inspection failed: ${packed.stderr}`);
const files = JSON.parse(packed.stdout)[0].files.map(file => file.path);
const required = ['README.md', 'LICENSE', 'SECURITY.md', 'CHANGELOG.md', 'index.js', 'index.d.ts', 'collector/Cargo.toml', 'collector/Cargo.lock', 'collector/src/main.rs'];
for (const path of required) if (!files.includes(path)) throw new Error(`Missing package file: ${path}`);
for (const path of files) {
  const allowed = /^(?:package\.json|index\.(?:js|d\.ts)|README\.md|LICENSE|SECURITY\.md|CHANGELOG\.md|src\/[a-z-]+\.js|collector\/(?:Cargo\.(?:toml|lock)|rust-toolchain\.toml|(?:src|tests)\/[a-z/-]+\.rs))$/;
  if (!allowed.test(path)) throw new Error(`Unexpected package file: ${path}`);
  if ((await lstat(join(sdk, path))).isSymbolicLink()) throw new Error(`Symlink in package: ${path}`);
}
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
for (const path of files.filter(path => path.startsWith('collector/'))) {
  const relative = path.slice('collector/'.length);
  if (digest(await readFile(join(sdk, path))) !== digest(await readFile(join(root, relative)))) throw new Error(`Stale collector source: ${path}`);
}
for (const path of ['LICENSE', 'SECURITY.md', 'CHANGELOG.md']) {
  if (digest(await readFile(join(sdk, path))) !== digest(await readFile(join(root, path)))) throw new Error(`Stale policy copy: ${path}`);
}
const secretPatterns = [/npm_[A-Za-z0-9]{20,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /AKIA[A-Z0-9]{16}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
let reviewedFiles = 0;
async function review(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'target', 'artifacts', 'collector'].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Source symlink requires manual review');
    if (entry.isDirectory()) await review(path);
    else {
      if (/^(?:\.env(?:\..*)?|\.npmrc)$/.test(entry.name)) throw new Error('Local credential configuration must not be uploaded');
      const contents = await readFile(path, 'utf8');
      if (secretPatterns.some(pattern => pattern.test(contents))) throw new Error('Potential credential found; content suppressed');
      reviewedFiles++;
    }
  }
}
await review(root);
console.log(JSON.stringify({ status: 'pass', packageName: pkg.name, version: pkg.version, packageFiles: files.length, reviewedSourceFiles: reviewedFiles, checks: ['metadata', 'runtime-dependencies', 'lifecycle-hooks', 'package-allowlist', 'source-sync', 'basic-secret-patterns'], limitation: 'Local hygiene checks, not a replacement for Snyk or a complete secret scanner' }, null, 2));
