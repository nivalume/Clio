//! Native engine: reads JSON commands, one per line, from stdin and writes one
//! JSON reply per line to stdout. Same engine as the WebAssembly build; used
//! for tests, benchmarks and `clio --engine native`.

use clio_core::Engine;
use std::io::{self, BufRead, Write};

fn main() {
    let mut engine = Engine::default();
    let stdin = io::stdin();
    let mut out = io::BufWriter::new(io::stdout().lock());
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let reply = engine.command(&line);
        let _ = writeln!(out, "{reply}");
        let _ = out.flush();
    }
}
