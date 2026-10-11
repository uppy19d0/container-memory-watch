import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** Explicit atomic replacement on the same filesystem; no automatic uploads. */
export async function writeDiagnosticReport(path, report) {
  const contents = JSON.stringify(report, null, 2) + '\n';
  const temporaryDirectory = await mkdtemp(join(dirname(path), '.oom-watch-'));
  try {
    const temporaryPath = join(temporaryDirectory, 'report.json');
    await writeFile(temporaryPath, contents, { mode: 0o600 });
    await rename(temporaryPath, path);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
