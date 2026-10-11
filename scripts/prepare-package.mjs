import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sdk = join(root, 'packages/node');
const collector = join(sdk, 'collector');
await rm(collector, { recursive: true, force: true });
await mkdir(collector, { recursive: true });
for (const file of ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', 'src', 'tests']) {
  await cp(join(root, file), join(collector, file), { recursive: true });
}
for (const file of ['LICENSE', 'SECURITY.md', 'CHANGELOG.md']) {
  await cp(join(root, file), join(sdk, file));
}
console.log('Prepared source-only SDK package; no binaries or credentials copied.');
