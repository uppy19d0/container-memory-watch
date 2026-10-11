//! Memory evidence and pure calculations; no filesystem or process access.

#[derive(Debug, PartialEq, Eq)]
pub struct Snapshot {
    pub current_bytes: u64,
    pub limit_bytes: Option<u64>,
    pub oom_kill_count: u64,
}

impl Snapshot {
    pub fn usage_ratio(&self) -> Option<f64> {
        self.limit_bytes
            .filter(|limit| *limit > 0)
            .map(|limit| self.current_bytes as f64 / limit as f64)
    }
    /// None means the counter reset or the cgroup changed; first samples are baselines.
    pub fn kills_since(&self, previous: &Self) -> Option<u64> {
        self.oom_kill_count.checked_sub(previous.oom_kill_count)
    }
}
