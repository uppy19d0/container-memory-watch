//! Request-driven persistent collection: one request produces one flushed frame.
use crate::collect;
use std::io::{self, BufRead, Read, Write};
use std::path::Path;

/// Blocking pipe I/O provides backpressure; there is no internal sample queue.
/// Input and output are bounded by the fixed request and snapshot schema.
pub fn serve(directory: &Path, mut input: impl BufRead, mut output: impl Write) -> io::Result<()> {
    loop {
        let mut request = Vec::with_capacity(16);
        let count = input.by_ref().take(16).read_until(b'\n', &mut request)?;
        if count == 0 {
            return Ok(());
        }
        if request != b"sample\n" {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "expected sample request",
            ));
        }
        let snapshot = collect(directory)?;
        writeln!(
            output,
            "{{\"protocolVersion\":1,\"snapshot\":{}}}",
            snapshot.to_json()
        )?;
        output.flush()?;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn empty_input_exits_without_collecting() {
        assert!(serve(Path::new("/missing"), &b""[..], Vec::new()).is_ok());
    }
    #[test]
    fn invalid_and_oversized_requests_fail_before_collection() {
        for input in [
            &b"invalid\n"[..],
            &b"sample"[..],
            &b"sampleeeeeeeeeeeeeeeeeeeeeeeee\n"[..],
        ] {
            assert_eq!(
                serve(Path::new("/missing"), input, Vec::new())
                    .unwrap_err()
                    .kind(),
                io::ErrorKind::InvalidInput
            );
        }
    }
}
