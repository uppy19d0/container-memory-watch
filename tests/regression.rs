//! Public API regression tests, independent of module layout.
use oom_watch::{collect, parse_events, parse_limit, Snapshot};
use std::fs;
fn sample(current: u64, limit: Option<u64>, kills: u64) -> Snapshot {
    Snapshot {
        current_bytes: current,
        limit_bytes: limit,
        oom_kill_count: kills,
    }
}
#[test]
fn limits_support_unlimited_and_large_values() {
    assert_eq!(parse_limit("max\n").unwrap(), None);
    assert_eq!(parse_limit("18446744073709551615").unwrap(), Some(u64::MAX));
    for input in ["0", "-1", "garbage", "18446744073709551616"] {
        assert!(parse_limit(input).is_err());
    }
}
#[test]
fn events_support_future_fields_and_reject_corruption() {
    assert_eq!(
        parse_events("oom 3\noom_kill 2\nfuture 9\n").unwrap()["oom_kill"],
        2
    );
    for input in [
        "oom_kill",
        "oom_kill -1",
        "oom_kill 2 extra",
        "oom_kill 1\noom_kill 2",
    ] {
        assert!(parse_events(input).is_err());
    }
}
#[test]
fn ratio_is_unknown_without_limit_and_can_exceed_one() {
    assert_eq!(sample(120, Some(100), 0).usage_ratio(), Some(1.2));
    assert_eq!(sample(120, None, 0).usage_ratio(), None);
}
#[test]
fn event_deltas_detect_resets() {
    assert_eq!(sample(1, None, 5).kills_since(&sample(1, None, 3)), Some(2));
    assert_eq!(sample(1, None, 2).kills_since(&sample(1, None, 3)), None);
}
#[test]
fn json_preserves_integer_precision() {
    assert_eq!(
        sample(u64::MAX, None, 2).to_json(),
        "{\"currentBytes\":\"18446744073709551615\",\"limitBytes\":null,\"oomKillCount\":\"2\"}"
    );
}
#[test]
fn collector_reads_fixture_and_requires_oom_counter() {
    let dir = std::env::temp_dir().join(format!("oom-watch-test-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("memory.current"), "80\n").unwrap();
    fs::write(dir.join("memory.max"), "100\n").unwrap();
    fs::write(dir.join("memory.events"), "oom_kill 4\n").unwrap();
    assert_eq!(collect(&dir).unwrap(), sample(80, Some(100), 4));
    fs::write(dir.join("memory.events"), "oom 4\n").unwrap();
    assert!(collect(&dir).is_err());
    fs::remove_dir_all(dir).unwrap();
}

#[test]
fn collector_rejects_oversized_input() {
    let dir = std::env::temp_dir().join(format!("oom-watch-bounds-{}", std::process::id()));
    fs::create_dir_all(&dir).unwrap();
    fs::write(dir.join("memory.current"), "1".repeat(65537)).unwrap();
    let error = collect(&dir).unwrap_err();
    assert_eq!(error.kind(), std::io::ErrorKind::InvalidData);
    assert!(error.to_string().contains("64 KiB"));
    fs::remove_dir_all(dir).unwrap();
}
