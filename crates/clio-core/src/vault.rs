//! The whole vault: link resolution, the knowledge graph, lint, search, and
//! the data each page and view needs.
//!
//! A *node* is one note id; a node can have one file per language (its
//! *variants*). Links resolve to nodes; pages are (node, language) pairs and
//! fall back to the default language when a translation is missing.

use crate::config::Config;
use crate::graph::{self, Graph};
use crate::markers::{self, marker};
use crate::note::{Diag, Heading, Level, LinkRef, Note, Origin, PluginBlock};
use crate::query::{self, Row};
use crate::search;
use crate::text::{self, encode_segment, escape};
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

#[derive(Debug, Clone, Serialize)]
pub struct PathDiag {
    pub path: String,
    #[serde(flatten)]
    pub diag: Diag,
}

#[derive(Debug, Clone)]
pub enum Resolution {
    Note { node: u32, anchor: Option<String> },
    SelfAnchor { anchor: Option<String> },
    Wanted { ghost: u32 },
}

#[derive(Debug, Clone, Serialize)]
pub struct Edge {
    pub source: u32,
    /// A node index, or `nodes.len() + ghost index` for a wanted note.
    pub target: u32,
    /// Relation name, `link` or `embed`.
    pub kind: String,
    #[serde(skip)]
    pub context: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Cluster {
    pub id: u32,
    pub label: String,
    pub size: u32,
    /// Node indices, highest PageRank first.
    #[serde(skip)]
    pub members: Vec<u32>,
}

pub struct Vault {
    /// Node keys in order; a node's index is its position.
    pub keys: Vec<String>,
    pub key_index: BTreeMap<String, u32>,
    /// Per node: language → note path.
    pub variants: Vec<BTreeMap<String, String>>,
    /// Per node: path of the default-language (or first) variant.
    pub primary: Vec<String>,
    /// Wanted targets (links to notes that do not exist): key → as written.
    pub ghosts: Vec<(String, String)>,
    pub resolved: BTreeMap<String, Vec<Resolution>>,
    pub edges: Vec<Edge>,
    pub incoming: Vec<Vec<usize>>,
    pub outgoing: Vec<Vec<usize>>,
    pub rank: Vec<f64>,
    pub cluster: Vec<u32>,
    pub clusters: Vec<Cluster>,
    pub diags: Vec<PathDiag>,
    pub search: search::Index,
}

fn lang_order(cfg: &Config, lang: &str) -> usize {
    cfg.locales
        .iter()
        .position(|l| l == lang)
        .unwrap_or(usize::MAX)
}

/// `YYYY-MM-DD` → days since 1970-01-01.
pub fn days(s: &str) -> Option<i64> {
    let s = s.get(..10)?;
    let mut it = s.split('-');
    let y: i64 = it.next()?.parse().ok()?;
    let m: i64 = it.next()?.parse().ok()?;
    let d: i64 = it.next()?.parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&d) {
        return None;
    }
    let y = if m <= 2 { y - 1 } else { y };
    let era = (if y >= 0 { y } else { y - 399 }) / 400;
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

impl Vault {
    pub fn build(notes: &BTreeMap<String, Note>, cfg: &Config) -> Vault {
        let mut diags: Vec<PathDiag> = Vec::new();
        let push = |diags: &mut Vec<PathDiag>, path: &str, d: Diag| {
            diags.push(PathDiag {
                path: path.to_string(),
                diag: d,
            })
        };

        // 1. Group files by id into nodes with language variants.
        let mut by_key: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();
        for (path, note) in notes {
            for d in &note.diags {
                push(&mut diags, path, d.clone());
            }
            let entry = by_key.entry(note.key.clone()).or_default();
            if let Some(other) = entry.get(&note.lang) {
                push(
                    &mut diags,
                    path,
                    Diag::new(
                        Level::Error,
                        1,
                        "duplicate-id",
                        format!("id `{}` ({}) is also used by {}", note.id, note.lang, other),
                    ),
                );
                continue;
            }
            entry.insert(note.lang.clone(), path.clone());
        }
        let keys: Vec<String> = by_key.keys().cloned().collect();
        let key_index: BTreeMap<String, u32> = keys
            .iter()
            .enumerate()
            .map(|(i, k)| (k.clone(), i as u32))
            .collect();
        let variants: Vec<BTreeMap<String, String>> = by_key.into_values().collect();
        let primary: Vec<String> = variants
            .iter()
            .map(|v| {
                v.iter()
                    .min_by_key(|(lang, path)| (lang_order(cfg, lang), (*path).clone()))
                    .map(|(_, p)| p.clone())
                    .unwrap_or_default()
            })
            .collect();
        let n = keys.len();

        // 2. Lookup tables: aliases, titles, paths, file stems.
        let mut alias_idx: BTreeMap<String, BTreeSet<u32>> = BTreeMap::new();
        let mut title_idx: BTreeMap<String, BTreeSet<u32>> = BTreeMap::new();
        let mut path_idx: BTreeMap<String, u32> = BTreeMap::new();
        for (i, vs) in variants.iter().enumerate() {
            for path in vs.values() {
                let note = &notes[path];
                for a in &note.aliases {
                    alias_idx.entry(text::key(a)).or_default().insert(i as u32);
                }
                title_idx
                    .entry(text::key(&note.title))
                    .or_default()
                    .insert(i as u32);
                let no_ext = path.strip_suffix(".md").unwrap_or(path);
                path_idx.insert(no_ext.to_string(), i as u32);
                if let Some((base, l)) = no_ext.rsplit_once('.') {
                    if cfg.locales.iter().any(|x| x == l) {
                        path_idx.entry(base.to_string()).or_insert(i as u32);
                    }
                }
            }
        }

        // 3. Resolve every link of every file.
        let mut ghosts: Vec<(String, String)> = Vec::new();
        let mut ghost_index: BTreeMap<String, u32> = BTreeMap::new();
        let mut resolved: BTreeMap<String, Vec<Resolution>> = BTreeMap::new();
        for (path, note) in notes {
            let mut out = Vec::with_capacity(note.links.len());
            for link in &note.links {
                let r = resolve_one(
                    link,
                    note,
                    notes,
                    cfg,
                    &key_index,
                    &alias_idx,
                    &title_idx,
                    &path_idx,
                    &variants,
                    &primary,
                    &mut ghosts,
                    &mut ghost_index,
                    &mut diags,
                    path,
                );
                out.push(r);
            }
            resolved.insert(path.clone(), out);
        }

        // 4. Edges, from each node's primary file.
        let mut edges: Vec<Edge> = Vec::new();
        let mut seen: BTreeSet<(u32, u32, String)> = BTreeSet::new();
        for (i, path) in primary.iter().enumerate() {
            let note = &notes[path];
            for (link, res) in note.links.iter().zip(&resolved[path]) {
                let target = match res {
                    Resolution::Note { node, .. } if *node as usize != i => *node,
                    Resolution::Wanted { ghost } => n as u32 + ghost,
                    _ => continue,
                };
                let kind = match (&link.rel, link.origin) {
                    (Some(r), _) => r.clone(),
                    (None, Origin::Embed) => "embed".into(),
                    _ => "link".into(),
                };
                if seen.insert((i as u32, target, kind.clone())) {
                    edges.push(Edge {
                        source: i as u32,
                        target,
                        kind,
                        context: link.context.clone(),
                    });
                }
            }
        }
        let total = n + ghosts.len();
        let mut incoming = vec![Vec::new(); total];
        let mut outgoing = vec![Vec::new(); total];
        for (e_idx, e) in edges.iter().enumerate() {
            outgoing[e.source as usize].push(e_idx);
            incoming[e.target as usize].push(e_idx);
        }

        // 5. PageRank and communities over real notes.
        let pairs: Vec<(u32, u32)> = edges
            .iter()
            .filter(|e| (e.target as usize) < n)
            .map(|e| (e.source, e.target))
            .collect();
        let g = Graph::new(n, &pairs);
        let rank = graph::pagerank(&g, 40);
        let cluster = graph::louvain(&g);
        let k = cluster
            .iter()
            .copied()
            .max()
            .map(|m| m as usize + 1)
            .unwrap_or(0);
        let mut members: Vec<Vec<u32>> = vec![Vec::new(); k];
        for (i, &c) in cluster.iter().enumerate() {
            members[c as usize].push(i as u32);
        }
        let clusters: Vec<Cluster> = members
            .into_iter()
            .enumerate()
            .map(|(c, mut m)| {
                m.sort_by(|a, b| {
                    rank[*b as usize]
                        .partial_cmp(&rank[*a as usize])
                        .unwrap_or(std::cmp::Ordering::Equal)
                        .then(a.cmp(b))
                });
                let mut tag_count: BTreeMap<&str, u32> = BTreeMap::new();
                for &x in &m {
                    for t in &notes[&primary[x as usize]].tags {
                        *tag_count.entry(t.as_str()).or_default() += 1;
                    }
                }
                let best_tag = tag_count
                    .iter()
                    .filter(|(_, c)| **c >= 2)
                    .max_by(|a, b| a.1.cmp(b.1).then(b.0.cmp(a.0)))
                    .map(|(t, _)| format!("#{t}"));
                let label = best_tag.unwrap_or_else(|| {
                    m.first()
                        .map(|x| notes[&primary[*x as usize]].title.clone())
                        .unwrap_or_default()
                });
                Cluster {
                    id: c as u32,
                    label,
                    size: m.len() as u32,
                    members: m,
                }
            })
            .collect();

        // 6. Vault-level lint.
        lint(
            notes, cfg, &keys, &variants, &primary, &incoming, &edges, &mut diags,
        );
        diags.sort_by(|a, b| a.path.cmp(&b.path).then(a.diag.cmp(&b.diag)));
        diags.dedup_by(|a, b| a.path == b.path && a.diag == b.diag);

        // 7. Search over primary files.
        let search = search::Index::build(primary.iter().map(|p| {
            let note = &notes[p];
            search::Doc {
                title: &note.title,
                aliases: format!("{} {}", note.aliases.join(" "), note.tags.join(" ")),
                headings: note
                    .headings
                    .iter()
                    .map(|h| h.text.as_str())
                    .collect::<Vec<_>>()
                    .join(" "),
                body: &note.text,
            }
        }));

        Vault {
            keys,
            key_index,
            variants,
            primary,
            ghosts,
            resolved,
            edges,
            incoming,
            outgoing,
            rank,
            cluster,
            clusters,
            diags,
            search,
        }
    }

    pub fn node_count(&self) -> usize {
        self.keys.len()
    }

    /// Node for an id, alias or title.
    pub fn find(&self, notes: &BTreeMap<String, Note>, target: &str) -> Option<u32> {
        let k = text::key(target);
        if let Some(i) = self.key_index.get(&k) {
            return Some(*i);
        }
        (0..self.keys.len() as u32).find(|&i| {
            self.variants[i as usize].values().any(|p| {
                let n = &notes[p];
                text::key(&n.title) == k || n.aliases.iter().any(|a| text::key(a) == k)
            })
        })
    }

    /// The file to show for `node` in `lang`, and whether it is a fallback.
    pub fn variant<'n>(
        &self,
        notes: &'n BTreeMap<String, Note>,
        node: u32,
        lang: &str,
    ) -> (&'n Note, bool) {
        let vs = &self.variants[node as usize];
        match vs.get(lang) {
            Some(p) => (&notes[p], false),
            None => (&notes[&self.primary[node as usize]], true),
        }
    }

    pub fn url(
        &self,
        notes: &BTreeMap<String, Note>,
        cfg: &Config,
        node: u32,
        lang: &str,
    ) -> String {
        let id = &notes[&self.primary[node as usize]].id;
        format!("{}n/{}", cfg.prefix(lang), encode_segment(id))
    }
}

#[allow(clippy::too_many_arguments)]
fn resolve_one(
    link: &LinkRef,
    note: &Note,
    notes: &BTreeMap<String, Note>,
    cfg: &Config,
    key_index: &BTreeMap<String, u32>,
    alias_idx: &BTreeMap<String, BTreeSet<u32>>,
    title_idx: &BTreeMap<String, BTreeSet<u32>>,
    path_idx: &BTreeMap<String, u32>,
    variants: &[BTreeMap<String, String>],
    primary: &[String],
    ghosts: &mut Vec<(String, String)>,
    ghost_index: &mut BTreeMap<String, u32>,
    diags: &mut Vec<PathDiag>,
    path: &str,
) -> Resolution {
    let warn = |diags: &mut Vec<PathDiag>, code: &str, msg: String| {
        diags.push(PathDiag {
            path: path.to_string(),
            diag: Diag::new(Level::Warning, link.line, code, msg),
        })
    };
    if link.target.is_empty() {
        let anchor = anchor_in(note, link, diags, path);
        return Resolution::SelfAnchor { anchor };
    }
    let k = text::key(&link.target);
    let mut found: Option<u32> = None;
    if link.origin == Origin::Markdown {
        found = path_idx.get(&link.target).copied().or_else(|| {
            let stem = link.target.rsplit('/').next().unwrap_or(&link.target);
            key_index.get(&text::key(stem)).copied()
        });
    }
    if found.is_none() {
        found = key_index.get(&k).copied();
    }
    if found.is_none() {
        for idx in [alias_idx, title_idx] {
            if let Some(set) = idx.get(&k) {
                if set.len() > 1 {
                    warn(
                        diags,
                        "ambiguous-link",
                        format!(
                            "`{}` matches {} notes; using the first",
                            link.target,
                            set.len()
                        ),
                    );
                }
                found = set.iter().next().copied();
                break;
            }
        }
    }
    if found.is_none() {
        found = path_idx.get(link.target.trim_end_matches(".md")).copied();
    }
    match found {
        Some(node) => {
            let vs = &variants[node as usize];
            let target_note = vs
                .get(&note.lang)
                .map(|p| &notes[p])
                .unwrap_or(&notes[&primary[node as usize]]);
            let anchor = anchor_in(target_note, link, diags, path);
            let _ = cfg;
            Resolution::Note { node, anchor }
        }
        None => {
            if link.origin != Origin::Frontmatter || link.rel.is_some() {
                warn(
                    diags,
                    "wanted",
                    format!("link to missing note `{}`", link.target),
                );
            }
            let g = *ghost_index.entry(k.clone()).or_insert_with(|| {
                ghosts.push((k.clone(), link.target.clone()));
                ghosts.len() as u32 - 1
            });
            Resolution::Wanted { ghost: g }
        }
    }
}

/// Heading slug or block anchor inside `target` for the link's `#heading` / `^block`.
fn anchor_in(
    target: &Note,
    link: &LinkRef,
    diags: &mut Vec<PathDiag>,
    path: &str,
) -> Option<String> {
    if let Some(b) = &link.block {
        if target.blocks.iter().any(|x| &x.id == b) {
            return Some(format!("b-{b}"));
        }
        diags.push(PathDiag {
            path: path.to_string(),
            diag: Diag::new(
                Level::Warning,
                link.line,
                "missing-anchor",
                format!("no block `^{b}` in `{}`", target.id),
            ),
        });
        return None;
    }
    if let Some(h) = &link.heading {
        let hk = text::key(h);
        if let Some(found) = target
            .headings
            .iter()
            .find(|x| &x.slug == h || text::key(&x.text) == hk || x.slug == hk)
        {
            return Some(found.slug.clone());
        }
        diags.push(PathDiag {
            path: path.to_string(),
            diag: Diag::new(
                Level::Warning,
                link.line,
                "missing-anchor",
                format!("no heading `{h}` in `{}`", target.id),
            ),
        });
    }
    None
}

#[allow(clippy::too_many_arguments)]
fn lint(
    notes: &BTreeMap<String, Note>,
    cfg: &Config,
    keys: &[String],
    variants: &[BTreeMap<String, String>],
    primary: &[String],
    incoming: &[Vec<usize>],
    edges: &[Edge],
    diags: &mut Vec<PathDiag>,
) {
    let today = days(&cfg.today);
    let mut query_errors: Vec<PathDiag> = Vec::new();
    let mut found: Vec<PathDiag> = Vec::new();
    let mut add = |path: &str, level: Level, code: &str, msg: String| {
        found.push(PathDiag {
            path: path.to_string(),
            diag: Diag::new(level, 1, code, msg),
        });
    };
    for (i, path) in primary.iter().enumerate() {
        let note = &notes[path];
        let is_home = keys[i] == "index" || keys[i] == "home";
        if incoming[i].is_empty() && !is_home {
            add(
                path,
                Level::Info,
                "orphan",
                "no other note links here".into(),
            );
        }
        if note.words == 0 {
            add(
                path,
                Level::Info,
                "empty-note",
                "the note has no text yet".into(),
            );
        }
        if let Some(t) = cfg.types.iter().find(|t| t.name == note.kind) {
            for field in &t.required {
                if !note.data.contains_key(field) {
                    add(
                        path,
                        Level::Warning,
                        "required-field",
                        format!("type `{}` requires `{field}`", note.kind),
                    );
                }
            }
        }
        let checked = note.reviewed.as_deref().or(note.updated.as_deref());
        if let (Some(t), Some(c)) = (today, checked.and_then(days)) {
            if t - c > cfg.stale_days as i64 {
                add(
                    path,
                    Level::Info,
                    "stale",
                    format!("last reviewed {} days ago", t - c),
                );
            }
        }
        if cfg.multilingual() {
            for lang in &cfg.locales {
                match variants[i].get(lang) {
                    None => add(
                        path,
                        Level::Info,
                        "translation-missing",
                        format!("no `{lang}` version"),
                    ),
                    Some(vp) if vp != path => {
                        let v = &notes[vp];
                        match &v.translation_of_hash {
                            Some(h) if h != &note.hash => add(
                                vp,
                                Level::Warning,
                                "translation-stale",
                                format!(
                                    "translated from {h}, but `{}` is now {}",
                                    note.path, note.hash
                                ),
                            ),
                            None => add(
                                vp,
                                Level::Info,
                                "translation-unpinned",
                                format!("add `translation-of-hash: {}`", note.hash),
                            ),
                            _ => {}
                        }
                    }
                    _ => {}
                }
            }
        }
        for (qi, q) in note.queries.iter().enumerate() {
            if let Err(e) = query::parse(&q.source) {
                query_errors.push(PathDiag {
                    path: path.clone(),
                    diag: Diag::new(
                        Level::Warning,
                        q.line,
                        "query",
                        format!("query {}: {e}", qi + 1),
                    ),
                });
            }
        }
    }
    diags.append(&mut found);
    diags.append(&mut query_errors);
    // part-of cycles.
    let n = keys.len();
    let mut parent: Vec<Vec<u32>> = vec![Vec::new(); n];
    for e in edges {
        if e.kind == "part-of" && (e.target as usize) < n {
            parent[e.source as usize].push(e.target);
        }
    }
    let mut state = vec![0u8; n];
    for start in 0..n {
        if state[start] != 0 {
            continue;
        }
        let mut stack = vec![(start as u32, 0usize)];
        state[start] = 1;
        while let Some((v, i)) = stack.pop() {
            if let Some(&w) = parent[v as usize].get(i) {
                stack.push((v, i + 1));
                match state[w as usize] {
                    0 => {
                        state[w as usize] = 1;
                        stack.push((w, 0));
                    }
                    1 => {
                        diags.push(PathDiag {
                            path: primary[v as usize].clone(),
                            diag: Diag::new(
                                Level::Warning,
                                1,
                                "part-of-cycle",
                                format!("`part-of` forms a cycle through `{}`", keys[w as usize]),
                            ),
                        });
                    }
                    _ => {}
                }
            } else {
                state[v as usize] = 2;
            }
        }
    }
}

// ---------------------------------------------------------------- pages

/// UI strings the engine writes into HTML.
fn t(lang: &str, key: &str) -> &'static str {
    let zh = lang.starts_with("zh");
    match key {
        "no-matches" => {
            if zh {
                "没有匹配的笔记"
            } else {
                "No matching notes"
            }
        }
        "title" => {
            if zh {
                "标题"
            } else {
                "Title"
            }
        }
        "wanted" => {
            if zh {
                "待写"
            } else {
                "Not written yet"
            }
        }
        "embed-loop" => {
            if zh {
                "（循环嵌入，已省略）"
            } else {
                "(embed loop, skipped)"
            }
        }
        "embed-depth" => {
            if zh {
                "（嵌入层数过多，已省略）"
            } else {
                "(embedded too deeply, skipped)"
            }
        }
        "linked-from" => {
            if zh {
                "链接到这里"
            } else {
                "Linked from"
            }
        }
        _ => "",
    }
}

pub struct PageCtx<'a> {
    pub vault: &'a Vault,
    pub notes: &'a BTreeMap<String, Note>,
    pub cfg: &'a Config,
    pub lang: &'a str,
}

struct QRow<'a> {
    note: &'a Note,
    node: u32,
    inn: usize,
    out: usize,
}

impl Row for QRow<'_> {
    fn values(&self, field: &str) -> Vec<String> {
        let n = self.note;
        let one = |s: &str| vec![s.to_string()];
        let opt = |s: &Option<String>| s.iter().cloned().collect::<Vec<_>>();
        match field {
            "id" => one(&n.id),
            "title" => one(&n.title),
            "type" => one(&n.kind),
            "tag" | "tags" => n.tags.clone(),
            "status" => opt(&n.status),
            "lang" => one(&n.lang),
            "path" => one(&n.path),
            "folder" => one(n.path.rsplit_once('/').map(|x| x.0).unwrap_or("")),
            "updated" => opt(&n.updated),
            "created" => opt(&n.created),
            "reviewed" => opt(&n.reviewed),
            "words" => one(&n.words.to_string()),
            "in" | "backlinks" => one(&self.inn.to_string()),
            "out" | "links" => one(&self.out.to_string()),
            "summary" => one(&n.summary),
            other => match n.data.get(other) {
                Some(Value::Array(a)) => a
                    .iter()
                    .map(|v| {
                        v.as_str()
                            .map(str::to_string)
                            .unwrap_or_else(|| v.to_string())
                    })
                    .collect(),
                Some(Value::String(s)) => one(s),
                Some(Value::Null) | None => Vec::new(),
                Some(v) => one(&v.to_string()),
            },
        }
    }
}

impl PageCtx<'_> {
    fn note_of(&self, node: u32) -> (&Note, bool) {
        self.vault.variant(self.notes, node, self.lang)
    }

    fn link_open(&self, link: &LinkRef, res: &Resolution) -> String {
        let rel = link
            .rel
            .as_ref()
            .map(|r| format!(" data-rel=\"{}\"", escape(r)))
            .unwrap_or_default();
        match res {
            Resolution::Note { node, anchor } => {
                let (target, fallback) = self.note_of(*node);
                let mut href = self.vault.url(self.notes, self.cfg, *node, self.lang);
                if let Some(a) = anchor {
                    href.push('#');
                    href.push_str(&encode_segment(a));
                }
                format!(
                    "<a class=\"wl\" href=\"{}\" data-id=\"{}\" data-type=\"{}\"{}{}>",
                    escape(&href),
                    escape(&target.id),
                    escape(&target.kind),
                    rel,
                    if fallback { " data-fallback" } else { "" }
                )
            }
            Resolution::SelfAnchor { anchor } => {
                format!(
                    "<a class=\"wl\" href=\"#{}\"{rel}>",
                    escape(&encode_segment(anchor.as_deref().unwrap_or("")))
                )
            }
            Resolution::Wanted { .. } => format!(
                "<a class=\"wl wanted\" href=\"{}wanted#{}\" data-wanted=\"{}\" title=\"{}\"{rel}>",
                escape(&self.cfg.prefix(self.lang)),
                escape(&encode_segment(&link.target)),
                escape(&link.target),
                t(self.lang, "wanted")
            ),
        }
    }

    fn link_text(&self, link: &LinkRef, res: &Resolution) -> String {
        let suffix = |base: String| match (&link.heading, &link.block) {
            (Some(h), _) if !base.is_empty() => format!("{base} › {h}"),
            (Some(h), _) => h.clone(),
            _ => base,
        };
        let s = match res {
            Resolution::Note { node, .. } => suffix(self.note_of(*node).0.title.clone()),
            Resolution::SelfAnchor { .. } => suffix(String::new()),
            Resolution::Wanted { .. } => suffix(link.target.clone()),
        };
        escape(&s)
    }

    /// Note HTML with every marker except plugin blocks resolved. Plugin
    /// markers are renumbered into `plugins` (embedded notes bring theirs).
    pub fn html(
        &self,
        path: &str,
        depth: u32,
        stack: &mut Vec<String>,
        plugins: &mut Vec<PluginBlock>,
    ) -> String {
        let note = &self.notes[path];
        let res = &self.vault.resolved[path];
        stack.push(path.to_string());
        let out = markers::replace(&note.html, |kind, n| match kind {
            markers::LINK => match (note.links.get(n), res.get(n)) {
                (Some(l), Some(r)) => self.link_open(l, r),
                _ => "<a>".into(),
            },
            markers::LINK_TEXT => match (note.links.get(n), res.get(n)) {
                (Some(l), Some(r)) => self.link_text(l, r),
                _ => String::new(),
            },
            markers::EMBED => match (note.links.get(n), res.get(n)) {
                (Some(l), Some(r)) => self.embed(l, r, depth, stack, plugins),
                _ => String::new(),
            },
            markers::PLUGIN => match note.plugins.get(n) {
                Some(p) => {
                    plugins.push(p.clone());
                    marker(markers::PLUGIN, plugins.len() - 1)
                }
                None => String::new(),
            },
            markers::QUERY => match note.queries.get(n) {
                Some(q) => self.query_html(&q.source),
                None => String::new(),
            },
            markers::HEADING => marker(markers::HEADING, n),
            _ => String::new(),
        });
        stack.pop();
        out
    }

    fn embed(
        &self,
        link: &LinkRef,
        res: &Resolution,
        depth: u32,
        stack: &mut Vec<String>,
        plugins: &mut Vec<PluginBlock>,
    ) -> String {
        let Resolution::Note { node, .. } = res else {
            return format!(
                "<div class=\"embed embed-missing\">{}{}</a></div>\n",
                self.link_open(link, res),
                self.link_text(link, res)
            );
        };
        let (target, _) = self.note_of(*node);
        let head = format!(
            "<div class=\"embed-head\">{}{}</a></div>",
            self.link_open(link, res),
            self.link_text(link, res)
        );
        if stack.iter().any(|p| p == &target.path) {
            return format!(
                "<div class=\"embed\">{head}<p class=\"embed-note\">{}</p></div>\n",
                t(self.lang, "embed-loop")
            );
        }
        if depth >= 3 {
            return format!(
                "<div class=\"embed\">{head}<p class=\"embed-note\">{}</p></div>\n",
                t(self.lang, "embed-depth")
            );
        }
        if let Some(b) = &link.block {
            let text = target
                .blocks
                .iter()
                .find(|x| &x.id == b)
                .map(|x| x.text.clone())
                .unwrap_or_default();
            return format!(
                "<div class=\"embed embed-block\">{head}<blockquote><p>{}</p></blockquote></div>\n",
                escape(&text)
            );
        }
        let full = self.html(&target.path.clone(), depth + 1, stack, plugins);
        let body = section(&full, &target.headings, link.heading.as_deref());
        // Embedded headings must not steal the page's anchors.
        let body = body.replace(" id=\"", " data-embed-id=\"");
        format!("<div class=\"embed\" data-embed=\"{}\">{head}<div class=\"embed-body\">\n{body}</div></div>\n", escape(&target.id))
    }

    pub fn query_html(&self, source: &str) -> String {
        let q = match query::parse(source) {
            Ok(q) => q,
            Err(e) => {
                return format!(
                    "<div class=\"query-error\">clio-query: {}</div>\n",
                    escape(&e)
                )
            }
        };
        let n = self.vault.node_count();
        let rows: Vec<QRow> = (0..n as u32)
            .map(|i| {
                let (note, _) = self.note_of(i);
                QRow {
                    note,
                    node: i,
                    inn: self.vault.incoming[i as usize].len(),
                    out: self.vault.outgoing[i as usize].len(),
                }
            })
            .collect();
        let mut rows = rows;
        rows.sort_by(|a, b| {
            a.note
                .title
                .to_lowercase()
                .cmp(&b.note.title.to_lowercase())
                .then(a.node.cmp(&b.node))
        });
        let hits = query::run(&q, &rows);
        if hits.is_empty() {
            return format!(
                "<p class=\"query-empty\">{}</p>\n",
                t(self.lang, "no-matches")
            );
        }
        let link = |r: &QRow| {
            format!(
                "<a class=\"wl\" href=\"{}\" data-id=\"{}\" data-type=\"{}\">{}</a>",
                escape(&self.vault.url(self.notes, self.cfg, r.node, self.lang)),
                escape(&r.note.id),
                escape(&r.note.kind),
                escape(&r.note.title)
            )
        };
        match q.show.as_str() {
            "table" => {
                let fields = if q.fields.is_empty() {
                    vec!["type".to_string(), "updated".to_string()]
                } else {
                    q.fields.clone()
                };
                let mut out = format!(
                    "<div class=\"table-wrap\"><table class=\"query-table\"><thead><tr><th>{}</th>",
                    t(self.lang, "title")
                );
                for f in &fields {
                    out.push_str(&format!("<th>{}</th>", escape(f)));
                }
                out.push_str("</tr></thead><tbody>");
                for r in &hits {
                    out.push_str(&format!("<tr><td>{}</td>", link(r)));
                    for f in &fields {
                        out.push_str(&format!("<td>{}</td>", escape(&r.values(f).join(", "))));
                    }
                    out.push_str("</tr>");
                }
                out.push_str("</tbody></table></div>\n");
                out
            }
            "cards" => {
                let mut out = String::from("<div class=\"query-cards\">");
                for r in &hits {
                    out.push_str(&format!(
                        "<div class=\"query-card\" data-type=\"{}\">{}<p>{}</p></div>",
                        escape(&r.note.kind),
                        link(r),
                        escape(&r.note.summary)
                    ));
                }
                out.push_str("</div>\n");
                out
            }
            _ => {
                let mut out = String::from("<ul class=\"query-list\">");
                for r in &hits {
                    let summary = if r.note.summary.is_empty() {
                        String::new()
                    } else {
                        format!(
                            " <span class=\"query-summary\">{}</span>",
                            escape(&text::truncate(&r.note.summary, 90))
                        )
                    };
                    out.push_str(&format!("<li>{}{summary}</li>", link(r)));
                }
                out.push_str("</ul>\n");
                out
            }
        }
    }

    fn item(&self, node: u32, context: &str) -> Value {
        if node as usize >= self.vault.node_count() {
            let (k, label) = &self.vault.ghosts[node as usize - self.vault.node_count()];
            return json!({ "id": k, "title": label, "type": "wanted", "wanted": true, "url": format!("{}wanted#{}", self.cfg.prefix(self.lang), encode_segment(label)), "context": context });
        }
        let (note, _) = self.note_of(node);
        json!({
            "id": note.id, "title": note.title, "type": note.kind, "summary": note.summary,
            "url": self.vault.url(self.notes, self.cfg, node, self.lang), "context": context,
        })
    }

    fn label(&self, rel: &str, inverse: bool) -> String {
        let def = self.cfg.relation(rel);
        let map = match def {
            Some(d) if inverse && !d.symmetric => &d.inverse_label,
            Some(d) => &d.label,
            None => {
                return if inverse {
                    format!("← {rel}")
                } else {
                    rel.to_string()
                }
            }
        };
        map.get(self.lang)
            .or_else(|| map.values().next())
            .cloned()
            .unwrap_or_else(|| rel.to_string())
    }

    /// Everything the page view needs for one (node, language).
    pub fn page(&self, node: u32) -> Value {
        let (note, fallback) = self.note_of(node);
        let mut plugins = Vec::new();
        let mut stack = Vec::new();
        let html = self.html(&note.path, 0, &mut stack, &mut plugins);
        let html = markers::replace(&html, |k, n| {
            if k == markers::PLUGIN {
                marker(k, n)
            } else {
                String::new()
            }
        });

        // Typed relations, both directions, grouped by label.
        let mut groups: BTreeMap<(u8, String), Vec<Value>> = BTreeMap::new();
        let mut backlinks = Vec::new();
        for &e in &self.vault.outgoing[node as usize] {
            let edge = &self.vault.edges[e];
            if edge.kind == "link" || edge.kind == "embed" {
                continue;
            }
            groups
                .entry((0, self.label(&edge.kind, false)))
                .or_default()
                .push(self.item(edge.target, ""));
        }
        for &e in &self.vault.incoming[node as usize] {
            let edge = &self.vault.edges[e];
            match edge.kind.as_str() {
                "link" | "embed" => backlinks.push(self.item(edge.source, &edge.context)),
                k => {
                    let symmetric = self.cfg.relation(k).is_some_and(|d| d.symmetric);
                    groups
                        .entry((1, self.label(k, !symmetric)))
                        .or_default()
                        .push(self.item(edge.source, &edge.context));
                }
            }
        }
        let relations: Vec<Value> = groups
            .into_iter()
            .map(|((dir, label), items)| json!({ "label": label, "direction": if dir == 0 { "out" } else { "in" }, "items": items }))
            .collect();

        // One hop of neighbours with the edges among them, for the local graph.
        let mut hood: BTreeSet<u32> = BTreeSet::new();
        hood.insert(node);
        for &e in self.vault.outgoing[node as usize]
            .iter()
            .chain(&self.vault.incoming[node as usize])
        {
            let edge = &self.vault.edges[e];
            hood.insert(edge.source);
            hood.insert(edge.target);
        }
        let local_nodes: Vec<Value> = hood.iter().map(|&i| self.item(i, "")).collect();
        let pos: BTreeMap<u32, usize> = hood.iter().enumerate().map(|(p, &i)| (i, p)).collect();
        let local_edges: Vec<Value> = self
            .vault
            .edges
            .iter()
            .filter(|e| {
                (e.source == node || e.target == node)
                    && pos.contains_key(&e.source)
                    && pos.contains_key(&e.target)
            })
            .map(|e| json!([pos[&e.source], pos[&e.target], e.kind]))
            .collect();

        let translations: Vec<Value> = self
            .cfg
            .locales
            .iter()
            .map(|l| {
                let vp = self.vault.variants[node as usize].get(l);
                json!({ "lang": l, "url": self.vault.url(self.notes, self.cfg, node, l), "exists": vp.is_some(),
                        "title": vp.map(|p| self.notes[p].title.clone()) })
            })
            .collect();

        json!({
            "id": note.id, "key": self.vault.keys[node as usize], "lang": self.lang, "noteLang": note.lang,
            "fallback": fallback, "path": note.path, "title": note.title, "type": note.kind, "summary": note.summary,
            "tags": note.tags, "aliases": note.aliases, "status": note.status, "created": note.created,
            "updated": note.updated, "reviewed": note.reviewed, "words": note.words,
            "url": self.vault.url(self.notes, self.cfg, node, self.lang),
            "html": html, "plugins": plugins, "outline": outline(&note.headings),
            "relations": relations, "backlinks": backlinks,
            "local": { "nodes": local_nodes, "edges": local_edges },
            "translations": translations,
            "rank": self.vault.rank.get(node as usize).copied().unwrap_or(0.0),
            "cluster": self.vault.cluster.get(node as usize).copied().unwrap_or(0),
            "data": note.data,
        })
    }
}

fn outline(headings: &[Heading]) -> Vec<Value> {
    headings
        .iter()
        .filter(|h| (2..=4).contains(&h.depth))
        .map(|h| json!({ "depth": h.depth, "text": h.text, "slug": h.slug }))
        .collect()
}

/// The part of `html` under heading `name` (or the whole note without its H1).
fn section(html: &str, headings: &[Heading], name: Option<&str>) -> String {
    let marks = markers::positions(html, markers::HEADING);
    match name {
        None => {
            // Drop a leading H1: the embed header already names the note.
            if let (Some(&(start, _, idx)), Some(h)) = (marks.first(), headings.first()) {
                if idx == 0 && h.depth == 1 && html[..start].trim().is_empty() {
                    if let Some(end) = html[start..].find("</h1>") {
                        return html[start + end + 5..].trim_start().to_string();
                    }
                }
            }
            html.to_string()
        }
        Some(name) => {
            let nk = text::key(name);
            let Some(hi) = headings
                .iter()
                .position(|h| h.slug == name || text::key(&h.text) == nk)
            else {
                return html.to_string();
            };
            let depth = headings[hi].depth;
            let Some(&(start, _, _)) = marks.iter().find(|m| m.2 == hi) else {
                return String::new();
            };
            let end = marks
                .iter()
                .filter(|m| m.0 > start && headings.get(m.2).is_some_and(|h| h.depth <= depth))
                .map(|m| m.0)
                .next()
                .unwrap_or(html.len());
            html[start..end].to_string()
        }
    }
}
