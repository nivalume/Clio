//! The engine as a JSON command processor, shared by the WebAssembly module
//! and the native binary so both behave identically.
//!
//! State: the configuration and every note, keyed by vault-relative path.
//! Commands are JSON objects with a `cmd` field; replies are JSON.

use crate::config::Config;
use crate::note::{parse_note, Note};
use crate::text::{self, truncate};
use crate::vault::{PageCtx, Vault};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Default)]
pub struct Engine {
    pub cfg: Config,
    pub notes: BTreeMap<String, Note>,
    pub vault: Option<Vault>,
}

impl Engine {
    pub fn new(cfg: Config) -> Self {
        Engine {
            cfg: cfg.normalised(),
            notes: BTreeMap::new(),
            vault: None,
        }
    }

    /// Parse (or re-parse) one note. Unchanged text is not parsed again.
    pub fn upsert(&mut self, path: &str, text: &str) {
        let hash = crate::text::hash_hex(&crate::markers::sanitize(text).replace("\r\n", "\n"));
        if self.notes.get(path).is_some_and(|n| n.hash == hash) {
            return;
        }
        let note = parse_note(path, text, &self.cfg);
        self.notes.insert(path.to_string(), note);
        self.vault = None;
    }

    pub fn remove(&mut self, path: &str) {
        if self.notes.remove(path).is_some() {
            self.vault = None;
        }
    }

    /// Build the vault if anything changed since the last build.
    pub fn vault(&mut self) -> &Vault {
        if self.vault.is_none() {
            self.vault = Some(Vault::build(&self.notes, &self.cfg));
        }
        self.vault.as_ref().expect("built above")
    }

    fn lang<'a>(&'a self, v: &'a Value) -> &'a str {
        v.get("lang")
            .and_then(Value::as_str)
            .unwrap_or_else(|| self.cfg.default_locale())
    }

    /// Run one JSON command; errors come back as `{"error": "..."}`.
    pub fn command(&mut self, input: &str) -> String {
        let reply = match serde_json::from_str::<Value>(input) {
            Ok(v) => self.dispatch(&v),
            Err(e) => json!({ "error": format!("bad command JSON: {e}") }),
        };
        serde_json::to_string(&reply).unwrap_or_else(|e| format!("{{\"error\":\"{e}\"}}"))
    }

    fn dispatch(&mut self, v: &Value) -> Value {
        let s = |k: &str| v.get(k).and_then(Value::as_str).unwrap_or("");
        match s("cmd") {
            "version" => json!({ "version": crate::version() }),
            "config" => match serde_json::from_value::<Config>(
                v.get("config").cloned().unwrap_or(json!({})),
            ) {
                Ok(cfg) => {
                    let cfg = cfg.normalised();
                    let changed =
                        serde_json::to_value(&cfg).ok() != serde_json::to_value(&self.cfg).ok();
                    self.cfg = cfg;
                    if changed {
                        // Parsed notes depend on the configuration; the host sends the files again.
                        self.notes.clear();
                        self.vault = None;
                    }
                    json!({ "ok": true, "cleared": changed })
                }
                Err(e) => json!({ "error": format!("bad config: {e}") }),
            },
            "upsert" => {
                self.upsert(s("path"), s("text"));
                json!({ "ok": true })
            }
            "remove" => {
                self.remove(s("path"));
                json!({ "ok": true })
            }
            "parse" => serde_json::to_value(parse_note(s("path"), s("text"), &self.cfg))
                .unwrap_or(Value::Null),
            "count" => json!({ "notes": self.notes.len() }),
            "build" => self.summary(),
            "pages" => self.pages(),
            "page" => self.page(v),
            "site" => self.site(v),
            "manifest" => self.manifest(v),
            "graph" => self.graph(v),
            "lint" => self.lint(),
            "search" => self.search(v),
            "context" => self.context(v),
            "backlinks" => self.backlinks(v),
            "translations" => self.translations(),
            "resolve" => {
                self.vault();
                let vault = self.vault.as_ref().unwrap();
                match vault.find(&self.notes, s("target")) {
                    Some(i) => {
                        json!({ "id": self.notes[&vault.primary[i as usize]].id, "path": vault.primary[i as usize] })
                    }
                    None => Value::Null,
                }
            }
            other => json!({ "error": format!("unknown command `{other}`") }),
        }
    }

    fn summary(&mut self) -> Value {
        self.vault();
        let v = self.vault.as_ref().unwrap();
        let count =
            |lvl: crate::note::Level| v.diags.iter().filter(|d| d.diag.level == lvl).count();
        json!({
            "notes": v.node_count(), "files": self.notes.len(), "edges": v.edges.len(), "wanted": v.ghosts.len(),
            "clusters": v.clusters.len(),
            "errors": count(crate::note::Level::Error), "warnings": count(crate::note::Level::Warning), "infos": count(crate::note::Level::Info),
        })
    }

    /// Every page the site has: each note in each language.
    fn pages(&mut self) -> Value {
        self.vault();
        let v = self.vault.as_ref().unwrap();
        let mut out = Vec::new();
        for i in 0..v.node_count() as u32 {
            for lang in &self.cfg.locales {
                let (note, fallback) = v.variant(&self.notes, i, lang);
                out.push(json!({ "node": i, "id": note.id, "lang": lang, "url": v.url(&self.notes, &self.cfg, i, lang), "fallback": fallback, "path": note.path }));
            }
        }
        Value::Array(out)
    }

    fn node_of(&mut self, v: &Value) -> Option<u32> {
        if let Some(n) = v.get("node").and_then(Value::as_u64) {
            return Some(n as u32);
        }
        let id = v
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        self.vault();
        self.vault.as_ref().unwrap().find(&self.notes, &id)
    }

    fn page(&mut self, v: &Value) -> Value {
        let Some(node) = self.node_of(v) else {
            return json!({ "error": "no such note" });
        };
        let lang = self.lang(v).to_string();
        let vault = self.vault.as_ref().unwrap();
        if node as usize >= vault.node_count() {
            return json!({ "error": "no such note" });
        }
        PageCtx {
            vault,
            notes: &self.notes,
            cfg: &self.cfg,
            lang: &lang,
        }
        .page(node)
    }

    fn site(&mut self, v: &Value) -> Value {
        let lang = self.lang(v).to_string();
        self.vault();
        let vault = self.vault.as_ref().unwrap();
        let notes = &self.notes;
        let cfg = &self.cfg;
        let item = |i: u32| {
            let (n, _) = vault.variant(notes, i, &lang);
            json!({ "id": n.id, "title": n.title, "type": n.kind, "summary": n.summary, "url": vault.url(notes, cfg, i, &lang),
                    "updated": n.updated, "rank": vault.rank[i as usize] })
        };
        let mut by_rank: Vec<u32> = (0..vault.node_count() as u32).collect();
        by_rank.sort_by(|a, b| {
            vault.rank[*b as usize]
                .partial_cmp(&vault.rank[*a as usize])
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.cmp(b))
        });
        let hubs: Vec<Value> = {
            let topics: Vec<u32> = by_rank
                .iter()
                .copied()
                .filter(|&i| notes[&vault.primary[i as usize]].kind == "topic")
                .collect();
            let pick = if topics.is_empty() {
                by_rank.clone()
            } else {
                topics
            };
            pick.into_iter().take(12).map(item).collect()
        };
        let mut recent: Vec<u32> = (0..vault.node_count() as u32)
            .filter(|&i| notes[&vault.primary[i as usize]].updated.is_some())
            .collect();
        recent.sort_by(|a, b| {
            let ua = &notes[&vault.primary[*a as usize]].updated;
            let ub = &notes[&vault.primary[*b as usize]].updated;
            ub.cmp(ua).then(a.cmp(b))
        });
        let mut type_count: BTreeMap<&str, usize> = BTreeMap::new();
        let mut tag_count: BTreeMap<&str, usize> = BTreeMap::new();
        let mut words = 0u64;
        for p in &vault.primary {
            let n = &notes[p];
            *type_count.entry(n.kind.as_str()).or_default() += 1;
            for t in &n.tags {
                *tag_count.entry(t.as_str()).or_default() += 1;
            }
            words += n.words as u64;
        }
        let mut types: Vec<Value> = cfg
            .types
            .iter()
            .map(|t| json!({ "name": t.name, "label": t.label.get(&lang).cloned().unwrap_or_else(|| t.name.clone()), "count": type_count.get(t.name.as_str()).copied().unwrap_or(0) }))
            .collect();
        for (name, count) in &type_count {
            if !cfg.types.iter().any(|t| &t.name == name) {
                types.push(json!({ "name": name, "label": name, "count": count }));
            }
        }
        let mut tags: Vec<(&str, usize)> = tag_count.into_iter().collect();
        tags.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        let clusters: Vec<Value> = vault
            .clusters
            .iter()
            .filter(|c| c.size >= 2)
            .map(|c| json!({ "id": c.id, "label": c.label, "size": c.size, "members": c.members.iter().take(8).map(|&i| item(i)).collect::<Vec<_>>() }))
            .collect();
        let count =
            |lvl: crate::note::Level| vault.diags.iter().filter(|d| d.diag.level == lvl).count();
        json!({
            "title": cfg.title, "base": cfg.base, "lang": lang, "locales": cfg.locales,
            "types": types, "relations": cfg.relations,
            "stats": { "notes": vault.node_count(), "files": notes.len(), "edges": vault.edges.len(), "wanted": vault.ghosts.len(), "words": words, "tags": tags.len() },
            "hubs": hubs, "recent": recent.into_iter().take(12).map(item).collect::<Vec<_>>(),
            "clusters": clusters,
            "tags": tags.iter().map(|(t, c)| json!([t, c])).collect::<Vec<_>>(),
            "lint": { "errors": count(crate::note::Level::Error), "warnings": count(crate::note::Level::Warning), "infos": count(crate::note::Level::Info) },
        })
    }

    /// Column-oriented list of every note, for the explore view and search filters.
    fn manifest(&mut self, v: &Value) -> Value {
        let lang = self.lang(v).to_string();
        self.vault();
        let vault = self.vault.as_ref().unwrap();
        let mut types: Vec<String> = self.cfg.types.iter().map(|t| t.name.clone()).collect();
        let mut tags: Vec<String> = Vec::new();
        let mut tag_ix: BTreeMap<String, usize> = BTreeMap::new();
        let (
            mut ids,
            mut titles,
            mut kinds,
            mut ntags,
            mut status,
            mut updated,
            mut folder,
            mut summary,
        ) = (
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
            vec![],
        );
        let (mut rank, mut cluster, mut words, mut inn, mut out, mut langs, mut urls) =
            (vec![], vec![], vec![], vec![], vec![], vec![], vec![]);
        for i in 0..vault.node_count() as u32 {
            let (n, _) = vault.variant(&self.notes, i, &lang);
            let ty = match types.iter().position(|t| t == &n.kind) {
                Some(p) => p,
                None => {
                    types.push(n.kind.clone());
                    types.len() - 1
                }
            };
            let tix: Vec<usize> = n
                .tags
                .iter()
                .map(|t| {
                    *tag_ix.entry(t.clone()).or_insert_with(|| {
                        tags.push(t.clone());
                        tags.len() - 1
                    })
                })
                .collect();
            ids.push(json!(n.id));
            titles.push(json!(n.title));
            kinds.push(json!(ty));
            ntags.push(json!(tix));
            status.push(json!(n.status));
            updated.push(json!(n.updated));
            folder.push(json!(n.path.rsplit_once('/').map(|x| x.0).unwrap_or("")));
            summary.push(json!(truncate(&n.summary, 140)));
            rank.push(json!((vault.rank[i as usize] * 1e6).round() / 1e6));
            cluster.push(json!(vault.cluster[i as usize]));
            words.push(json!(n.words));
            inn.push(json!(vault.incoming[i as usize].len()));
            out.push(json!(vault.outgoing[i as usize].len()));
            langs.push(json!(vault.variants[i as usize].keys().collect::<Vec<_>>()));
            urls.push(json!(vault.url(&self.notes, &self.cfg, i, &lang)));
        }
        json!({ "lang": lang, "types": types, "tags": tags, "id": ids, "title": titles, "type": kinds, "tagIds": ntags,
                "status": status, "updated": updated, "folder": folder, "summary": summary, "rank": rank,
                "cluster": cluster, "words": words, "in": inn, "out": out, "langs": langs, "url": urls })
    }

    fn graph(&mut self, v: &Value) -> Value {
        let lang = self.lang(v).to_string();
        self.vault();
        let vault = self.vault.as_ref().unwrap();
        let mut kinds: Vec<String> = Vec::new();
        let mut nodes = Vec::new();
        for i in 0..vault.node_count() as u32 {
            let (n, _) = vault.variant(&self.notes, i, &lang);
            nodes.push(json!({ "id": n.id, "title": n.title, "type": n.kind, "rank": (vault.rank[i as usize] * 1e6).round() / 1e6,
                               "cluster": vault.cluster[i as usize], "url": vault.url(&self.notes, &self.cfg, i, &lang) }));
        }
        for (k, label) in &vault.ghosts {
            nodes.push(json!({ "id": k, "title": label, "type": "wanted", "wanted": true, "rank": 0, "cluster": -1 }));
        }
        let edges: Vec<Value> = vault
            .edges
            .iter()
            .map(|e| {
                let k = match kinds.iter().position(|x| x == &e.kind) {
                    Some(p) => p,
                    None => {
                        kinds.push(e.kind.clone());
                        kinds.len() - 1
                    }
                };
                json!([e.source, e.target, k])
            })
            .collect();
        let clusters: Vec<Value> = vault
            .clusters
            .iter()
            .map(|c| json!({ "id": c.id, "label": c.label, "size": c.size }))
            .collect();
        json!({ "nodes": nodes, "edges": edges, "kinds": kinds, "clusters": clusters })
    }

    /// For every note and every other locale: missing, unpinned, stale or current.
    fn translations(&mut self) -> Value {
        self.vault();
        let vault = self.vault.as_ref().unwrap();
        let mut out = Vec::new();
        for i in 0..vault.node_count() {
            let src = &self.notes[&vault.primary[i]];
            let mut langs = Vec::new();
            for lang in &self.cfg.locales {
                if lang == &src.lang {
                    continue;
                }
                let entry = match vault.variants[i].get(lang) {
                    None => json!({ "lang": lang, "status": "missing", "path": null }),
                    Some(p) => {
                        let t = &self.notes[p];
                        let status = match &t.translation_of_hash {
                            None => "unpinned",
                            Some(h) if h == &src.hash => "current",
                            Some(_) => "stale",
                        };
                        json!({ "lang": lang, "status": status, "path": t.path, "translationOfHash": t.translation_of_hash })
                    }
                };
                langs.push(entry);
            }
            out.push(json!({ "id": src.id, "title": src.title, "path": src.path, "lang": src.lang, "hash": src.hash, "translations": langs }));
        }
        Value::Array(out)
    }

    fn lint(&mut self) -> Value {
        self.vault();
        serde_json::to_value(&self.vault.as_ref().unwrap().diags).unwrap_or(Value::Null)
    }

    fn search(&mut self, v: &Value) -> Value {
        let q = v.get("q").and_then(Value::as_str).unwrap_or("").to_string();
        let limit = v.get("limit").and_then(Value::as_u64).unwrap_or(20) as usize;
        let lang = self.lang(v).to_string();
        self.vault();
        let vault = self.vault.as_ref().unwrap();
        let toks: Vec<String> = crate::search::tokens(&q)
            .into_iter()
            .filter(|t| t.chars().count() > 1 || !t.chars().all(text::is_cjk))
            .collect();
        let hits: Vec<Value> = vault
            .search
            .search(&q, limit)
            .into_iter()
            .map(|(i, score)| {
                let (n, _) = vault.variant(&self.notes, i, &lang);
                let snippet = n
                    .text
                    .lines()
                    .find(|l| {
                        let lower = l.to_lowercase();
                        toks.iter().any(|t| lower.contains(t.as_str()))
                    })
                    .map(|l| {
                        let lower = l.to_lowercase();
                        let at = toks.iter().filter_map(|t| lower.find(t.as_str())).min().unwrap_or(0);
                        text::around(l, at, 120)
                    })
                    .unwrap_or_else(|| n.summary.clone());
                json!({ "id": n.id, "title": n.title, "type": n.kind, "path": n.path, "url": vault.url(&self.notes, &self.cfg, i, &lang),
                        "score": (score * 1000.0).round() / 1000.0, "snippet": snippet })
            })
            .collect();
        Value::Array(hits)
    }

    fn backlinks(&mut self, v: &Value) -> Value {
        let Some(node) = self.node_of(v) else {
            return json!({ "error": "no such note" });
        };
        let lang = self.lang(v).to_string();
        let vault = self.vault.as_ref().unwrap();
        let p = PageCtx {
            vault,
            notes: &self.notes,
            cfg: &self.cfg,
            lang: &lang,
        }
        .page(node);
        json!({ "id": p["id"], "relations": p["relations"], "backlinks": p["backlinks"] })
    }

    /// A note and its neighbourhood as one block of text for a language model.
    fn context(&mut self, v: &Value) -> Value {
        let Some(node) = self.node_of(v) else {
            return json!({ "error": "no such note" });
        };
        let hops = v.get("hops").and_then(Value::as_u64).unwrap_or(1).min(3) as usize;
        let lang = self.lang(v).to_string();
        let vault = self.vault.as_ref().unwrap();
        let n = vault.node_count();
        let mut seen: BTreeMap<u32, usize> = BTreeMap::new();
        seen.insert(node, 0);
        let mut frontier = vec![node];
        let mut rels: Vec<Value> = Vec::new();
        for hop in 1..=hops {
            let mut next = Vec::new();
            for &x in &frontier {
                for &e in vault.outgoing[x as usize]
                    .iter()
                    .chain(&vault.incoming[x as usize])
                {
                    let edge = &vault.edges[e];
                    let other = if edge.source == x {
                        edge.target
                    } else {
                        edge.source
                    };
                    if (other as usize) >= n {
                        continue;
                    }
                    if hop == 1 {
                        let dir = if edge.source == x { "out" } else { "in" };
                        rels.push(json!({ "id": self.notes[&vault.primary[other as usize]].id, "kind": edge.kind, "direction": dir, "context": edge.context }));
                    }
                    if let std::collections::btree_map::Entry::Vacant(slot) = seen.entry(other) {
                        slot.insert(hop);
                        next.push(other);
                    }
                }
            }
            frontier = next;
        }
        let (main, _) = vault.variant(&self.notes, node, &lang);
        let neighbours: Vec<Value> = seen
            .iter()
            .filter(|(i, _)| **i != node)
            .map(|(&i, &hop)| {
                let (nn, _) = vault.variant(&self.notes, i, &lang);
                json!({ "id": nn.id, "title": nn.title, "type": nn.kind, "summary": nn.summary, "path": nn.path, "hop": hop, "tags": nn.tags })
            })
            .collect();
        let wanted: BTreeSet<String> = vault.outgoing[node as usize]
            .iter()
            .map(|&e| vault.edges[e].target)
            .filter(|&t| t as usize >= n)
            .map(|t| vault.ghosts[t as usize - n].1.clone())
            .collect();
        json!({
            "note": { "id": main.id, "title": main.title, "type": main.kind, "path": main.path, "summary": main.summary,
                      "tags": main.tags, "aliases": main.aliases, "text": main.text, "headings": main.headings },
            "relations": rels, "neighbours": neighbours, "wanted": wanted,
        })
    }
}
