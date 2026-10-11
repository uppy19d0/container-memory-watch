//! Parse kernel text files strictly while allowing future event keys.

use std::{collections::BTreeMap, io};

pub(super) fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

pub fn parse_bytes(input: &str) -> io::Result<u64> {
    input
        .trim()
        .parse()
        .map_err(|_| invalid("invalid byte count"))
}

pub fn parse_limit(input: &str) -> io::Result<Option<u64>> {
    if input.trim() == "max" {
        return Ok(None);
    }
    let value = parse_bytes(input)?;
    if value == 0 {
        return Err(invalid("zero memory limit"));
    }
    Ok(Some(value))
}

pub fn parse_events(input: &str) -> io::Result<BTreeMap<String, u64>> {
    let mut events = BTreeMap::new();
    for line in input.lines().filter(|line| !line.trim().is_empty()) {
        let mut parts = line.split_whitespace();
        let key = parts.next().ok_or_else(|| invalid("missing event key"))?;
        let value = parse_bytes(parts.next().ok_or_else(|| invalid("missing event count"))?)?;
        if parts.next().is_some() || events.insert(key.to_owned(), value).is_some() {
            return Err(invalid("malformed or duplicate event"));
        }
    }
    Ok(events)
}
