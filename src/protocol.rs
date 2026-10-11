//! CLI wire format. Decimal strings preserve kernel integer precision in JS.

use crate::Snapshot;

impl Snapshot {
    pub fn to_json(&self) -> String {
        let limit = self
            .limit_bytes
            .map_or("null".into(), |n| format!("\"{n}\""));
        // Decimal strings preserve u64 precision in JavaScript.
        format!(
            "{{\"currentBytes\":\"{}\",\"limitBytes\":{},\"oomKillCount\":\"{}\"}}",
            self.current_bytes, limit, self.oom_kill_count
        )
    }
}
