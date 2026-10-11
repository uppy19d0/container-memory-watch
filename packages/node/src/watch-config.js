import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function discoverCgroup() {
  if (process.platform !== 'linux') return null;
  const text = await readFile('/proc/self/cgroup', 'utf8');
  if (text.length > 4096) return null;
  const path = text.split('\n').find(line => line.startsWith('0::/'))?.slice(3);
  if (!path || path.split('/').some(part => part === '..' || part === '.')) return null;
  // Conventional cgroup v2 mount only. Never silently select a host root instead.
  return join('/sys/fs/cgroup', path);
}

export async function collectorOptions(options) {
  const cgroupPath = options.cgroupPath ?? process.env.OOM_WATCH_CGROUP_PATH ?? await discoverCgroup();
  if (!cgroupPath) throw new Error('cgroup_v2_unavailable');
  for (const file of ['memory.current', 'memory.max', 'memory.events']) {
    await access(join(cgroupPath, file), constants.R_OK);
  }
  const configured = options.binaryPath ?? process.env.OOM_WATCH_BINARY;
  const candidates = configured ? [configured] : [
    fileURLToPath(new URL('../collector/target/release/oom-watch', import.meta.url)),
    '/opt/oom-watch/oom-watch',
  ];
  for (const binaryPath of candidates) {
    try { await access(binaryPath, constants.X_OK); return { binaryPath, cgroupPath, timeoutMs: options.timeoutMs ?? 2000 }; }
    catch { /* Try only known locations, never search PATH or download executables. */ }
  }
  throw new Error('collector_unavailable');
}

