import { spawn } from 'node:child_process';
import { decodeSnapshot } from './protocol.js';
import { enrichSnapshot } from './collector.js';

/** A single persistent collector with one in-flight request and no sample queue. */
export function createMemoryObserver({ binaryPath, cgroupPath, timeoutMs = 2000 }) {
  if (!binaryPath || !cgroupPath) throw new TypeError('binaryPath and cgroupPath are required');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new RangeError('timeoutMs must be a positive integer');
  const child = spawn(binaryPath, ['--serve', cgroupPath], { stdio: ['pipe', 'pipe', 'pipe'] });
  let pending = null;
  let terminalError = null;
  let closing = false;
  let buffer = '';
  let stderr = '';
  let closed = false;
  let resolveClosed;
  const closedPromise = new Promise(resolve => { resolveClosed = resolve; });

  function fail(error) {
    terminalError ??= error;
    if (pending) {
      clearTimeout(pending.timer);
      pending.reject(terminalError);
      pending = null;
    }
    if (!closed) child.kill('SIGKILL');
  }
  child.on('error', fail);
  child.stdin.on('error', fail);
  child.stdout.on('error', fail);
  child.stderr.on('error', fail);
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4096); });
  child.on('close', (code, signal) => {
    closed = true;
    if (pending || (!closing && !terminalError)) {
      fail(new Error(`Collector exited (${code ?? signal}): ${stderr}`));
    }
    resolveClosed();
  });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    if (terminalError) return;
    buffer += chunk;
    if (Buffer.byteLength(buffer) > 4096) return fail(new Error('Collector frame exceeds 4096 bytes'));
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;
    const frame = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    if (!pending || buffer.length) return fail(new Error('Unexpected collector frame'));
    try {
      const envelope = JSON.parse(frame);
      if (envelope?.protocolVersion !== 1) throw new Error('Unsupported collector protocol');
      const snapshot = decodeSnapshot(JSON.stringify(envelope.snapshot));
      const sample = enrichSnapshot(snapshot);
      clearTimeout(pending.timer);
      pending.resolve(sample);
      pending = null;
    } catch (error) { fail(error); }
  });

  return {
    sample() {
      if (terminalError) return Promise.reject(terminalError);
      if (closing || closed) return Promise.reject(new Error('Observer is closed'));
      if (pending) return Promise.reject(new Error('A sample request is already in progress'));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => fail(new Error('Collector sample timed out')), timeoutMs);
        pending = { resolve, reject, timer };
        child.stdin.write('sample\n', error => { if (error) fail(error); });
      });
    },
    async close() {
      if (!closing) {
        closing = true;
        if (pending) fail(new Error('Observer closed during sample'));
        else if (!closed) child.stdin.end();
      }
      const timer = setTimeout(() => { if (!closed) child.kill('SIGKILL'); }, timeoutMs);
      try { await closedPromise; } finally { clearTimeout(timer); }
    },
  };
}
