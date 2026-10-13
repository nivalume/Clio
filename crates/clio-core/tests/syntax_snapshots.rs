//! Each `tests/syntax/*.md` renders to `tests/syntax/*.html` (the HTML with
//! markers) and `*.json` (links, headings, blocks, plugins, tags, diagnostics).
//! Run with UPDATE_SNAPSHOTS=1 to rewrite the expected files after a deliberate change.

use clio_core::{parse_note, Config};
use std::fs;
use std::path::Path;

#[test]
fn syntax_snapshots() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/syntax");
    let cfg = Config::default().normalised();
    let update = std::env::var("UPDATE_SNAPSHOTS").is_ok();
    let mut checked = 0;
    let mut entries: Vec<_> = fs::read_dir(&dir)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .collect();
    entries.sort();
    for path in entries {
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let src = fs::read_to_string(&path).unwrap();
        let rel = format!(
            "notes/concepts/{}",
            path.file_name().unwrap().to_str().unwrap()
        );
        let note = parse_note(&rel, &src, &cfg);
        let html = note.html.replace('\u{E000}', "⟦").replace('\u{E001}', "⟧");
        let meta = serde_json::json!({
            "id": note.id, "title": note.title, "type": note.kind, "lang": note.lang,
            "aliases": note.aliases, "tags": note.tags, "summary": note.summary,
            "links": note.links, "headings": note.headings, "blocks": note.blocks,
            "plugins": note.plugins, "queries": note.queries, "assets": note.assets,
            "words": note.words, "diags": note.diags,
        });
        let meta = serde_json::to_string_pretty(&meta).unwrap() + "\n";
        for (ext, actual) in [("html", &html), ("json", &meta)] {
            let expected_path = path.with_extension(ext);
            if update || !expected_path.exists() {
                fs::write(&expected_path, actual).unwrap();
            } else {
                let expected = fs::read_to_string(&expected_path).unwrap();
                assert_eq!(
                    &expected,
                    actual,
                    "{} differs; run with UPDATE_SNAPSHOTS=1 if the change is intended",
                    expected_path.display()
                );
            }
        }
        checked += 1;
    }
    assert!(checked > 0);
}
