import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const forbiddenPath = /(?:^|\/)(?:\.git|\.github|node_modules|\.npmrc|\.env(?:\.[^/]*)?)(?:\/|$)|\.(?:pem|key|p12|pfx|tgz)$/i;
const credentials = [/(?:npm_[a-zA-Z0-9]{30,}|gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];

/** Return findings without exposing credential values. This is a release guard, not a complete secret scanner. */
export function inspectArtifact(manifest, files, readContent) {
  const issues = [];
  if (manifest.private) issues.push('Package is private');
  if (!manifest.name || !manifest.version || !manifest.license || !manifest.repository) issues.push('Missing name, version, license or repository metadata');
  if (!Array.isArray(manifest.files) || !manifest.files.length) issues.push('Explicit package files allowlist required');
  if (!manifest.publishConfig?.provenance) issues.push('Provenance must be enabled in publishConfig');
  for (const hook of ['preinstall', 'install', 'postinstall']) {
    if (manifest.scripts?.[hook]) issues.push(`Unexpected consumer install hook: ${hook}`);
  }
  const paths = new Set(files.map(file => file.path));
  if (!paths.has('README.md') || ![...paths].some(path => /^LICEN[CS]E(?:\.[^/]+)?$/i.test(path))) issues.push('README and license must be included');
  for (const file of files) {
    const path = file.path;
    if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => part === '..' || part === '')) {
      issues.push('Unsafe artifact path'); continue;
    }
    if (forbiddenPath.test(path)) { issues.push(`Forbidden artifact file: ${path}`); continue; }
    if (!Number.isFinite(file.size) || file.size > 32 * 1024 * 1024) { issues.push(`Invalid or oversized artifact file: ${path}`); continue; }
    if (credentials.some(pattern => pattern.test(readContent(path)))) issues.push(`Credential-like content detected in ${path}`);
  }
  return issues;
}

export function verifyPackage(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const artifacts = JSON.parse(execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, shell: false }));
  if (artifacts.length !== 1 || artifacts[0].name !== manifest.name || artifacts[0].version !== manifest.version) throw new Error('Unexpected npm artifact identity');
  const issues = inspectArtifact(manifest, artifacts[0].files, path => readFileSync(resolve(root, path), 'utf8'));
  if (issues.length) throw new Error(`${manifest.name}: ${issues.join('; ')}`);
  console.log(`${manifest.name}@${manifest.version}: checked ${artifacts[0].files.length} published files, metadata and consumer install hooks`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const directory of process.argv.slice(2).length ? process.argv.slice(2) : ['.']) verifyPackage(directory);
}
