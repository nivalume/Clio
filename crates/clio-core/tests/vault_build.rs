use clio_core::{Config, Engine};
use serde_json::{json, Value};
use std::fs;
use std::path::Path;

fn load() -> Engine {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/vault");
    let cfg = Config {
        locales: vec!["zh".into(), "en".into()],
        today: "2026-10-13".into(),
        stale_days: 180,
        ..Default::default()
    };
    let mut e = Engine::new(cfg);
    let mut stack = vec![root.clone()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).unwrap().flatten() {
            let p = entry.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.extension().and_then(|x| x.to_str()) == Some("md") {
                let rel = p
                    .strip_prefix(&root)
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .replace('\\', "/");
                e.upsert(&rel, &fs::read_to_string(&p).unwrap());
            }
        }
    }
    e
}

fn cmd(e: &mut Engine, v: Value) -> Value {
    serde_json::from_str(&e.command(&v.to_string())).unwrap()
}

#[test]
fn builds_the_graph() {
    let mut e = load();
    let s = cmd(&mut e, json!({"cmd": "build"}));
    assert_eq!(s["notes"], 6, "{s}");
    assert_eq!(s["files"], 7);
    assert_eq!(s["wanted"], 1);
    assert_eq!(s["errors"], 0, "{}", cmd(&mut e, json!({"cmd": "lint"})));
}

#[test]
fn page_resolves_links_relations_embeds() {
    let mut e = load();
    let p = cmd(
        &mut e,
        json!({"cmd": "page", "id": "pratt-parser", "lang": "zh"}),
    );
    let html = p["html"].as_str().unwrap();
    assert!(html.contains("href=\"/zh/n/tokenizer\""), "{html}");
    assert!(html.contains(">分词器</a>"));
    assert!(
        html.contains("href=\"/zh/n/parsing#历史\"")
            || html.contains("href=\"/zh/n/parsing#%E5%8E%86%E5%8F%B2\""),
        "{html}"
    );
    assert!(html.contains(">解析 › 历史</a>"));
    assert!(html.contains("href=\"#%E7%94%A8%E6%B3%95\""));
    assert!(html.contains("class=\"wl wanted\""));
    assert!(html.contains("class=\"embed\""), "{html}");
    assert!(html.contains("自顶向下"), "embedded section");
    assert!(!html.contains('\u{E000}'), "no markers left except plugins");
    // Outgoing typed relations are listed with their labels.
    let rels = p["relations"].as_array().unwrap();
    assert!(rels
        .iter()
        .any(|r| r["label"] == "依赖" && r["direction"] == "out"));
    // Incoming see-also (symmetric) from recursive-descent via alias `pratt`.
    assert!(
        rels.iter()
            .any(|r| r["label"] == "参见" && r["direction"] == "in"),
        "{rels:?}"
    );
    let t = cmd(
        &mut e,
        json!({"cmd": "page", "id": "tokenizer", "lang": "zh"}),
    );
    let trel = t["relations"].as_array().unwrap();
    assert!(
        trel.iter()
            .any(|r| r["label"] == "被依赖" && r["items"][0]["id"] == "pratt-parser"),
        "{trel:?}"
    );
    // Parsing's outline and has-part.
    let parsing = cmd(&mut e, json!({"cmd": "page", "id": "parsing"}));
    assert!(parsing["relations"]
        .as_array()
        .unwrap()
        .iter()
        .any(|r| r["label"] == "包含"));
    assert_eq!(parsing["outline"][0]["slug"], "历史");
}

#[test]
fn embed_loops_and_queries() {
    let mut e = load();
    let rd = cmd(&mut e, json!({"cmd": "page", "id": "recursive-descent"}));
    assert!(
        rd["html"].as_str().unwrap().contains("循环嵌入"),
        "{}",
        rd["html"]
    );
    let index = cmd(&mut e, json!({"cmd": "page", "id": "index"}));
    let html = index["html"].as_str().unwrap();
    assert!(html.contains("class=\"query-list\""));
    assert!(html.contains("Pratt 解析器") && html.contains("递归下降") && html.contains("分词器"));
    assert!(html.contains("class=\"query-table\""));
}

#[test]
fn translations_fall_back_and_go_stale() {
    let mut e = load();
    let en = cmd(
        &mut e,
        json!({"cmd": "page", "id": "pratt-parser", "lang": "en"}),
    );
    assert_eq!(en["fallback"], false);
    assert_eq!(en["title"], "Pratt parser");
    let en_tok = cmd(
        &mut e,
        json!({"cmd": "page", "id": "tokenizer", "lang": "en"}),
    );
    assert_eq!(en_tok["fallback"], true);
    assert_eq!(en_tok["url"], "/en/n/tokenizer");
    let lint = cmd(&mut e, json!({"cmd": "lint"}));
    let codes: Vec<&str> = lint
        .as_array()
        .unwrap()
        .iter()
        .map(|d| d["code"].as_str().unwrap())
        .collect();
    for code in [
        "translation-stale",
        "translation-missing",
        "wanted",
        "orphan",
        "empty-note",
        "stale",
    ] {
        assert!(codes.contains(&code), "missing {code} in {codes:?}");
    }
    let pages = cmd(&mut e, json!({"cmd": "pages"}));
    assert_eq!(pages.as_array().unwrap().len(), 12);
}

#[test]
fn search_and_context() {
    let mut e = load();
    let hits = cmd(&mut e, json!({"cmd": "search", "q": "解析器"}));
    assert_eq!(hits[0]["id"], "pratt-parser", "{hits}");
    let hits = cmd(&mut e, json!({"cmd": "search", "q": "token"}));
    assert_eq!(hits[0]["id"], "tokenizer", "{hits}");
    let ctx = cmd(&mut e, json!({"cmd": "context", "id": "pratt", "hops": 1}));
    assert_eq!(ctx["note"]["id"], "pratt-parser");
    assert!(ctx["wanted"]
        .as_array()
        .unwrap()
        .iter()
        .any(|w| w == "missing-note"));
    assert!(ctx["neighbours"].as_array().unwrap().len() >= 3);
    let r = cmd(&mut e, json!({"cmd": "resolve", "target": "Pratt 解析器"}));
    assert_eq!(r["id"], "pratt-parser");
}

#[test]
fn site_manifest_graph() {
    let mut e = load();
    let site = cmd(&mut e, json!({"cmd": "site"}));
    assert_eq!(site["stats"]["notes"], 6);
    assert_eq!(site["hubs"][0]["id"], "parsing");
    let m = cmd(&mut e, json!({"cmd": "manifest", "lang": "en"}));
    assert_eq!(m["id"].as_array().unwrap().len(), 6);
    let g = cmd(&mut e, json!({"cmd": "graph"}));
    assert_eq!(g["nodes"].as_array().unwrap().len(), 7);
    assert!(g["kinds"]
        .as_array()
        .unwrap()
        .iter()
        .any(|k| k == "depends-on"));
}

#[test]
fn rebuilds_after_changes() {
    let mut e = load();
    cmd(&mut e, json!({"cmd": "build"}));
    e.upsert(
        "notes/concepts/missing-note.md",
        "---\ntitle: 补上了\n---\n正文\n",
    );
    let s = cmd(&mut e, json!({"cmd": "build"}));
    assert_eq!(s["wanted"], 0);
    e.remove("notes/concepts/missing-note.md");
    let s = cmd(&mut e, json!({"cmd": "build"}));
    assert_eq!(s["wanted"], 1);
}
