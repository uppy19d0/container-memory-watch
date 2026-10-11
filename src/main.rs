use std::{env, io, path::Path, process::ExitCode};
fn main() -> ExitCode {
    let args: Vec<_> = env::args_os().skip(1).collect();
    let result = match args.as_slice() {
        [directory] => oom_watch::collect(Path::new(directory))
            .map(|snapshot| println!("{}", snapshot.to_json())),
        [mode, directory] if mode == "--serve" => oom_watch::observer::serve(
            Path::new(directory),
            io::stdin().lock(),
            io::stdout().lock(),
        ),
        _ => {
            eprintln!("Usage: oom-watch [--serve] <cgroup-v2-directory>");
            return ExitCode::from(2);
        }
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("Memory collection failed: {error}");
            ExitCode::from(1)
        }
    }
}
