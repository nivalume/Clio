//! Print one page payload of a vault directory:
//! `cargo run -p clio-core --example page -- <dir> <id> [lang]`.
use clio_core::{Config, Engine};
use std::{env, fs, path::Path};

fn main() {
    let args: Vec<String> = env::args().collect();
    let root = Path::new(&args[1]);
    let cfg = Config {
        locales: vec!["zh".into(), "en".into()],
        today: "2026-10-13".into(),
        ..Default::default()
    };
    let mut e = Engine::new(cfg);
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).unwrap().flatten() {
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.extension().and_then(|x| x.to_str()) == Some("md") {
                let rel = p.strip_prefix(root).unwrap().to_str().unwrap().to_string();
                e.upsert(&rel, &fs::read_to_string(&p).unwrap());
            }
        }
    }
    let lang = args.get(3).cloned().unwrap_or_else(|| "zh".into());
    let out = e.command(&format!(
        "{{\"cmd\":\"page\",\"id\":\"{}\",\"lang\":\"{}\"}}",
        args[2], lang
    ));
    let v: serde_json::Value = serde_json::from_str(&out).unwrap();
    println!("{}", v["html"].as_str().unwrap_or(""));
    let mut rest = v.clone();
    rest["html"] = serde_json::Value::Null;
    println!("{}", serde_json::to_string_pretty(&rest).unwrap());
}
