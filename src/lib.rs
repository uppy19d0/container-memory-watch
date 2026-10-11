//! Read-only memory evidence collection with independently testable boundaries.
//!
//! `model` defines evidence and calculations, `cgroup` reads Linux files, and
//! `protocol` defines the CLI wire format. The binary is only an entry point.
#![forbid(unsafe_code)]

pub mod cgroup;
pub mod model;
pub mod observer;
mod protocol;

pub use cgroup::{collect, parse_bytes, parse_events, parse_limit};
pub use model::Snapshot;
