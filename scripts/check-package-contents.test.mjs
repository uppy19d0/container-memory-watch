import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inspectArtifact } from './check-package-contents.mjs';
const manifest = { name: 'fixture', version: '1.0.0', license: 'MIT', repository: 'https://github.com/example/fixture', files: ['src', 'README.md', 'LICENSE'], publishConfig: { provenance: true } };
const files = ['README.md', 'LICENSE', 'package.json', 'src/index.js'].map(path => ({ path, size: 100 }));
const inspect = (options = {}) => inspectArtifact(options.manifest ?? manifest, options.files ?? files, options.read ?? (() => 'public content'));
test('accepts attributed allowlisted source packages with provenance', () => assert.deepEqual(inspect(), []));
test('rejects hidden credentials, nested environment files, archives and private keys', () => {
  for (const path of ['.npmrc', 'src/.env.production', '.git/config', 'node_modules/a/index.js', 'backup.tgz', 'private.pem']) assert.ok(inspect({ files: [...files, { path, size: 1 }] }).some(issue => issue.includes(path)));
});
test('rejects traversal and absolute paths before reading content', () => {
  for (const path of ['../outside', '/etc/passwd', 'src/../../outside', 'src\\outside']) assert.ok(inspect({ files: [...files, { path, size: 1 }], read: p => { assert.notEqual(p, path); return ''; } }).includes('Unsafe artifact path'));
});
test('rejects install hooks and absent provenance', () => {
  assert.ok(inspect({ manifest: { ...manifest, scripts: { postinstall: 'node download.js' } } }).some(issue => issue.includes('postinstall')));
  assert.ok(inspect({ manifest: { ...manifest, publishConfig: {} } }).some(issue => issue.includes('Provenance')));
});
test('detects credential-like text without revealing the matching value', () => {
  const secret = 'npm_' + 'a'.repeat(40);
  const result = inspect({ read: () => secret }); assert.ok(result.length); assert.ok(result.every(issue => !issue.includes(secret)));
  assert.ok(inspect({ read: () => '-----BEGIN ' + 'PRIVATE KEY-----' }).length);
});
test('requires package documentation and rejects oversized input', () => {
  assert.ok(inspect({ files: [] }).some(issue => issue.includes('license')));
  assert.ok(inspect({ files: [...files, { path: 'large.bin', size: 33 * 1024 * 1024 }] }).some(issue => issue.includes('oversized')));
});
