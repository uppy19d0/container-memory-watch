//! Linux cgroup v2 adapter. Paths are explicitly selected by the caller.

mod parser;
use crate::Snapshot;
use parser::invalid;
pub use parser::{parse_bytes, parse_events, parse_limit};
use std::{
    fs::File,
    io::{self, Read},
    path::Path,
};

const MAX_FILE_BYTES: u64 = 65536;

fn read_kernel_file(path: &Path) -> io::Result<String> {
    let mut text = String::new();
    File::open(path)?
        .take(MAX_FILE_BYTES + 1)
        .read_to_string(&mut text)?;
    if text.len() as u64 > MAX_FILE_BYTES {
        return Err(invalid("cgroup file exceeds 64 KiB"));
    }
    Ok(text)
}

/// Reads the caller-selected cgroup. The files are not an atomic snapshot.
/// Hierarchical memory.events counts may include descendant cgroups.
pub fn collect(directory: &Path) -> io::Result<Snapshot> {
    let current_bytes = parse_bytes(&read_kernel_file(&directory.join("memory.current"))?)?;
    let limit_bytes = parse_limit(&read_kernel_file(&directory.join("memory.max"))?)?;
    let events = parse_events(&read_kernel_file(&directory.join("memory.events"))?)?;
    let oom_kill_count = *events
        .get("oom_kill")
        .ok_or_else(|| invalid("missing oom_kill counter"))?;
    Ok(Snapshot {
        current_bytes,
        limit_bytes,
        oom_kill_count,
    })
}
