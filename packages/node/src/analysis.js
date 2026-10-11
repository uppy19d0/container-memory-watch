/** Counter deltas are evidence about the selected cgroup, not this Node PID. */
export function analyzeMemory(current, previous = null, threshold = 0.8) {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new RangeError('threshold must be in (0, 1]');
  const usageRatio = current.limitBytes === null ? null : Number(current.currentBytes) / Number(current.limitBytes);
  const reset = previous !== null && current.oomKillCount < previous.oomKillCount;
  return {
    usageRatio,
    underPressure: usageRatio !== null && usageRatio >= threshold,
    newOomKills: previous === null || reset ? null : current.oomKillCount - previous.oomKillCount,
    counterReset: reset,
  };
}
