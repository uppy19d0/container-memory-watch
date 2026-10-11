/** Validate the Rust wire format at the process boundary. */
export function decodeSnapshot(stdout) {
  const raw = JSON.parse(stdout);
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new TypeError("Collector output must be an object");
  }
  const integer = value => {
    if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) throw new TypeError('Invalid collector integer');
    const parsed = BigInt(value);
    if (parsed > 18446744073709551615n) throw new RangeError('Collector integer exceeds u64');
    return parsed;
  };
  const limitBytes = raw.limitBytes === null ? null : integer(raw.limitBytes);
  if (limitBytes === 0n) throw new RangeError('Invalid zero memory limit');
  return {
    currentBytes: integer(raw.currentBytes),
    limitBytes,
    oomKillCount: integer(raw.oomKillCount),
  };
}
