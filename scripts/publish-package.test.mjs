import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./publish-package.mjs', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('../packages/node/package.json', import.meta.url)));

async function invoke(t, mode) {
  const directory = await mkdtemp(join(tmpdir(), 'npm-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const cli = join(directory, 'npm.cjs');
  const calls = join(directory, 'calls.jsonl');
  await writeFile(cli, `
    require('node:fs').appendFileSync(process.env.TEST_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
    if (process.argv[2] !== 'view') process.exit(2);
    if (process.env.TEST_MODE === 'published') {
      console.log(JSON.stringify(process.env.TEST_VERSION));
    } else {
      console.log(JSON.stringify({ error: { code: process.env.TEST_MODE } }));
      process.exit(1);
    }
  `);
  const result = spawnSync(process.execPath, [script], {
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: 'true', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.invalid', RUNNER_TEMP: directory, npm_execpath: cli, TEST_CALLS: calls, TEST_MODE: mode, TEST_VERSION: version },
  });
  return { result, calls: (await readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse) };
}

test('an already public version succeeds without packing or publishing', async t => {
  const { result, calls } = await invoke(t, 'published');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /publication skipped/);
  assert.deepEqual(calls.map(call => call[0]), ['view']);
});

test('only a registry E404 allows attempting to pack an unpublished version', async t => {
  const { result, calls } = await invoke(t, 'E404');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /npm pack failed/);
  assert.deepEqual(calls.map(call => call[0]), ['view', 'pack']);
});

test('an authentication failure blocks packing and publication', async t => {
  const { result, calls } = await invoke(t, 'E401');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /publication blocked/);
  assert.deepEqual(calls.map(call => call[0]), ['view']);
});
