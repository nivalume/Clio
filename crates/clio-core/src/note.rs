//! One note: frontmatter, identity, Clio Markdown passes, HTML with markers.

use crate::config::Config;
use crate::frontmatter::{self, list, string, unwrap_link};
use crate::markers::{self, marker};
use crate::render;
use crate::text::{self, escape};
use comrak::html::Anchorizer;
use comrak::nodes::{AstNode, NodeBlockDirective, NodeValue, NodeWikiLink};
use comrak::{parse_document, Arena, Options};
use serde::Serialize;
use serde_json::{Map, Value};
use std::borrow::Cow;
use std::collections::BTreeSet;

#[derive(Debug, Clone, Serialize)]
pub struct Note {
    pub path: String,
    pub id: String,
    /// Lookup key for `id` (lowercase, normalised).
    pub key: String,
    pub lang: String,
    pub title: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub aliases: Vec<String>,
    pub tags: Vec<String>,
    pub status: Option<String>,
    pub created: Option<String>,
    pub updated: Option<String>,
    pub reviewed: Option<String>,
    pub summary: String,
    /// Content hash of the whole file (12 hex digits).
    pub hash: String,
    /// `translation-of-hash` from the frontmatter, for staleness checks.
    pub translation_of_hash: Option<String>,
    pub data: Map<String, Value>,
    /// HTML with markers; see [`crate::markers`].
    pub html: String,
    pub links: Vec<LinkRef>,
    pub headings: Vec<Heading>,
    pub blocks: Vec<BlockRef>,
    pub plugins: Vec<PluginBlock>,
    pub queries: Vec<QueryBlock>,
    pub assets: Vec<String>,
    /// Plain text of the body, block per line (search, snippets).
    pub text: String,
    pub words: u32,
    pub body_line: u32,
    pub diags: Vec<Diag>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Origin {
    Wiki,
    Markdown,
    Frontmatter,
    Embed,
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkRef {
    /// Target as written: an id, alias or title; a vault path for Markdown links.
    pub target: String,
    pub rel: Option<String>,
    pub heading: Option<String>,
    pub block: Option<String>,
    /// Link text given in the source (`[[id|text]]`, `[text](x.md)`).
    pub label: Option<String>,
    pub origin: Origin,
    pub line: u32,
    /// The sentence or block the link sits in.
    pub context: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Heading {
    pub depth: u8,
    pub text: String,
    pub slug: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct BlockRef {
    pub id: String,
    pub text: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginBlock {
    /// `code`, `math`, `mermaid`, `chart`.
    pub kind: String,
    pub lang: String,
    pub title: Option<String>,
    /// 1-based lines to highlight (`{1,3-5}`).
    pub highlight: Vec<u32>,
    /// Remaining `key=value` pairs from the info string.
    pub attrs: Map<String, Value>,
    pub display: bool,
    pub text: String,
    /// HTML used when no plugin handles this block.
    pub fallback: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct QueryBlock {
    pub source: String,
    pub line: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq, PartialOrd, Ord)]
pub struct Diag {
    pub level: Level,
    pub line: u32,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Error,
    Warning,
    Info,
}

impl Diag {
    pub fn new(level: Level, line: u32, code: &str, message: impl Into<String>) -> Self {
        Diag {
            level,
            line,
            code: code.into(),
            message: message.into(),
        }
    }
}

/// comrak options used for every note.
pub fn comrak_options() -> Options<'static> {
    let mut o = Options::default();
    let e = &mut o.extension;
    e.strikethrough = true;
    e.table = true;
    e.autolink = true;
    e.tasklist = true;
    e.footnotes = true;
    e.description_lists = true;
    e.math_dollars = true;
    e.wikilinks_title_after_pipe = true;
    e.cjk_friendly_emphasis = true;
    e.highlight = true;
    e.block_directive = true;
    o.render.r#unsafe = false;
    o
}

const IMAGE_EXT: &[&str] = &["png", "jpg", "jpeg", "gif", "svg", "webp", "avif"];
const DIRECTIVES: &[&str] = &[
    "tabs", "tab", "cards", "card", "steps", "details", "columns", "column",
];
pub const CALLOUTS: &[&str] = &[
    "note",
    "abstract",
    "summary",
    "info",
    "todo",
    "tip",
    "hint",
    "important",
    "success",
    "question",
    "warning",
    "caution",
    "attention",
    "failure",
    "danger",
    "error",
    "bug",
    "example",
    "quote",
];
/// Separator inside the info string of a callout node made by the engine.
pub const CALLOUT_SEP: char = '\u{1}';

struct Ctx<'c> {
    cfg: &'c Config,
    path: String,
    lang: String,
    line0: u32,
    links: Vec<LinkRef>,
    blocks: Vec<BlockRef>,
    plugins: Vec<PluginBlock>,
    queries: Vec<QueryBlock>,
    assets: BTreeSet<String>,
    tags: BTreeSet<String>,
    diags: Vec<Diag>,
}

type N<'a> = &'a AstNode<'a>;

fn line_of(n: N<'_>, ctx: &Ctx) -> u32 {
    n.data().sourcepos.start.line as u32 + ctx.line0 - 1
}

fn raw<'a>(arena: &'a Arena<'a>, html: String) -> N<'a> {
    arena.alloc(AstNode::from(NodeValue::Raw(html)))
}

fn text_node<'a>(arena: &'a Arena<'a>, s: String) -> N<'a> {
    arena.alloc(AstNode::from(NodeValue::Text(Cow::Owned(s))))
}

/// Plain text of a subtree, the way a reader sees it. A `[[link]]` without
/// its own text reads as its target (not `rel::target`).
pub fn plain(n: N<'_>) -> String {
    let mut out = String::new();
    plain_into(n, &mut out);
    out
}

fn plain_into(n: N<'_>, out: &mut String) {
    let wiki_url = match &n.data().value {
        NodeValue::Text(t) => {
            out.push_str(t);
            return;
        }
        NodeValue::Code(c) => {
            out.push_str(&c.literal);
            return;
        }
        NodeValue::Math(m) => {
            out.push_str(&m.literal);
            return;
        }
        NodeValue::SoftBreak | NodeValue::LineBreak => {
            out.push(' ');
            return;
        }
        NodeValue::WikiLink(w) => Some(w.url.clone()),
        _ => None,
    };
    if let Some(url) = wiki_url {
        let mut label = String::new();
        for c in n.children() {
            plain_into(c, &mut label);
        }
        if label.trim() == url.trim() {
            let (_, target, heading, _) = parse_target(&percent_decode(&url));
            out.push_str(if target.is_empty() {
                heading.as_deref().unwrap_or("")
            } else {
                &target
            });
        } else {
            out.push_str(&label);
        }
        return;
    }
    for c in n.children() {
        plain_into(c, out);
    }
}

fn is_leaf_block(v: &NodeValue) -> bool {
    matches!(
        v,
        NodeValue::Paragraph
            | NodeValue::Heading(_)
            | NodeValue::TableCell
            | NodeValue::DescriptionTerm
    )
}

/// Nearest ancestor that is a leaf block (paragraph, heading, table cell).
fn leaf_block<'a>(n: N<'a>) -> Option<N<'a>> {
    n.ancestors().find(|a| is_leaf_block(&a.data().value))
}

fn context_for(n: N<'_>, label: &str) -> String {
    match leaf_block(n) {
        Some(b) => {
            let t = text::squash(&plain(b));
            let at = t.find(label).unwrap_or(0);
            text::around(&t, at, 160)
        }
        None => String::new(),
    }
}

/// `rel::target#heading^block` → parts.
pub fn parse_target(url: &str) -> (Option<String>, String, Option<String>, Option<String>) {
    let mut s = url.trim();
    let mut rel = None;
    if let Some((r, rest)) = s.split_once("::") {
        let r = r.trim();
        if !r.is_empty()
            && r.chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            rel = Some(r.to_lowercase());
            s = rest.trim();
        }
    }
    let mut block = None;
    let mut heading = None;
    let mut target = s;
    if let Some((t, b)) = target.split_once('^') {
        block = Some(b.trim().to_string()).filter(|b| !b.is_empty());
        target = t;
    }
    if let Some((t, h)) = target.split_once('#') {
        heading = Some(h.trim().to_string()).filter(|h| !h.is_empty());
        target = t;
    }
    (rel, target.trim().to_string(), heading, block)
}

/// Normalise a vault-relative path: resolve `.` and `..`, drop leading `/`.
pub fn normalise_path(p: &str) -> String {
    let mut out: Vec<&str> = Vec::new();
    for part in p.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                out.pop();
            }
            x => out.push(x),
        }
    }
    out.join("/")
}

fn dir_of(path: &str) -> &str {
    path.rfind('/').map(|i| &path[..i]).unwrap_or("")
}

fn is_external(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.starts_with("http:")
        || lower.starts_with("https:")
        || lower.starts_with("mailto:")
        || lower.starts_with("tel:")
        || lower.starts_with("data:")
        || lower.starts_with("//")
}

/// Parse a directive info string: `name{.cls #id key="v"} rest`.
pub struct DirectiveInfo {
    pub name: String,
    pub attrs: Vec<(String, String)>,
    pub classes: Vec<String>,
    pub id: Option<String>,
    pub rest: String,
}

impl DirectiveInfo {
    pub fn attr(&self, key: &str) -> Option<&str> {
        self.attrs
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v.as_str())
    }
    pub fn title(&self) -> Option<String> {
        self.attr("title")
            .map(str::to_string)
            .or_else(|| Some(self.rest.clone()).filter(|r| !r.is_empty()))
    }
}

pub fn parse_directive(info: &str) -> DirectiveInfo {
    let info = info.trim();
    let name_end = info
        .find(|c: char| c == '{' || c.is_whitespace())
        .unwrap_or(info.len());
    let name = info[..name_end].to_lowercase();
    let mut rest = info[name_end..].trim_start();
    let mut attrs = Vec::new();
    let mut classes = Vec::new();
    let mut id = None;
    if let Some(body) = rest.strip_prefix('{') {
        if let Some(end) = body.find('}') {
            parse_attrs(&body[..end], &mut attrs, &mut classes, &mut id);
            rest = body[end + 1..].trim_start();
        }
    }
    DirectiveInfo {
        name,
        attrs,
        classes,
        id,
        rest: rest.trim().to_string(),
    }
}

fn parse_attrs(
    s: &str,
    attrs: &mut Vec<(String, String)>,
    classes: &mut Vec<String>,
    id: &mut Option<String>,
) {
    let mut chars = s.chars().peekable();
    loop {
        while chars.peek().is_some_and(|c| c.is_whitespace()) {
            chars.next();
        }
        let Some(&c) = chars.peek() else { break };
        let mut word = String::new();
        let mut value: Option<String> = None;
        while let Some(&c) = chars.peek() {
            if c.is_whitespace() {
                break;
            }
            if c == '=' {
                chars.next();
                let mut v = String::new();
                if chars.peek() == Some(&'"') {
                    chars.next();
                    for c in chars.by_ref() {
                        if c == '"' {
                            break;
                        }
                        v.push(c);
                    }
                } else {
                    while let Some(&c) = chars.peek() {
                        if c.is_whitespace() {
                            break;
                        }
                        v.push(c);
                        chars.next();
                    }
                }
                value = Some(v);
                break;
            }
            word.push(c);
            chars.next();
        }
        match (c, value) {
            ('.', None) => classes.push(word[1..].to_string()),
            ('#', None) => *id = Some(word[1..].to_string()),
            (_, Some(v)) => attrs.push((word, v)),
            (_, None) if !word.is_empty() => attrs.push((word, "true".into())),
            _ => {}
        }
    }
}

/// Parse a code fence info string: `rust title="src/lib.rs" {3-5}`.
fn parse_info(info: &str) -> (String, Option<String>, Vec<u32>, Map<String, Value>) {
    let info = info.trim();
    let lang_end = info
        .find(|c: char| c.is_whitespace() || c == '{')
        .unwrap_or(info.len());
    let lang = info[..lang_end].to_lowercase();
    let mut rest = info[lang_end..].to_string();
    let mut highlight = Vec::new();
    if let (Some(a), Some(b)) = (rest.find('{'), rest.find('}')) {
        if a < b {
            let spec = rest[a + 1..b].to_string();
            let is_lines = spec
                .chars()
                .all(|c| c.is_ascii_digit() || c == ',' || c == '-' || c == ' ');
            if is_lines {
                for part in spec.split(',') {
                    let part = part.trim();
                    if let Some((x, y)) = part.split_once('-') {
                        if let (Ok(x), Ok(y)) = (x.trim().parse::<u32>(), y.trim().parse::<u32>()) {
                            highlight.extend(x..=y.min(x + 10_000));
                        }
                    } else if let Ok(x) = part.parse::<u32>() {
                        highlight.push(x);
                    }
                }
                rest.replace_range(a..=b, "");
            }
        }
    }
    let (mut attrs, mut classes, mut id) = (Vec::new(), Vec::new(), None);
    parse_attrs(&rest, &mut attrs, &mut classes, &mut id);
    let mut map = Map::new();
    let mut title = None;
    for (k, v) in attrs {
        if k == "title" {
            title = Some(v);
        } else {
            map.insert(k, Value::String(v));
        }
    }
    highlight.sort_unstable();
    highlight.dedup();
    (lang, title, highlight, map)
}

fn code_fallback(lang: &str, title: &Option<String>, body: &str) -> String {
    let mut out = String::from("<figure class=\"code\">");
    if let Some(t) = title {
        out.push_str(&format!("<figcaption>{}</figcaption>", escape(t)));
    }
    let cls = if lang.is_empty() {
        String::new()
    } else {
        format!(" class=\"language-{}\"", escape(lang))
    };
    out.push_str(&format!(
        "<pre><code{cls}>{}</code></pre></figure>",
        escape(body)
    ));
    out
}

/// Is `s` a usable tag (not only digits)?
fn valid_tag(s: &str) -> bool {
    !s.is_empty()
        && !s
            .chars()
            .all(|c| c.is_ascii_digit() || c == '/' || c == '-')
}

fn tag_char(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '-' || c == '/'
}

/// Split text into plain runs and `#tags`.
fn split_tags(s: &str) -> Vec<(bool, String)> {
    let mut out: Vec<(bool, String)> = Vec::new();
    let mut buf = String::new();
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        let prev_ok = i == 0 || {
            let p = chars[i - 1];
            p.is_whitespace()
                || matches!(
                    p,
                    '(' | '（' | '，' | '。' | '、' | '；' | '：' | ',' | ';' | '「' | '“'
                )
        };
        if c == '#' && prev_ok && i + 1 < chars.len() && tag_char(chars[i + 1]) {
            let mut j = i + 1;
            while j < chars.len() && tag_char(chars[j]) {
                j += 1;
            }
            let mut tag: String = chars[i + 1..j].iter().collect();
            while tag.ends_with('/') || tag.ends_with('-') {
                tag.pop();
            }
            if valid_tag(&tag) {
                if !buf.is_empty() {
                    out.push((false, std::mem::take(&mut buf)));
                }
                let used = tag.chars().count();
                out.push((true, tag));
                i = i + 1 + used;
                continue;
            }
        }
        buf.push(c);
        i += 1;
    }
    if !buf.is_empty() {
        out.push((false, buf));
    }
    out
}

pub fn parse_note(path: &str, source: &str, cfg: &Config) -> Note {
    let text_owned = markers::sanitize(source).replace("\r\n", "\n");
    let hash = text::hash_hex(&text_owned);
    let split = frontmatter::split(&text_owned);
    let mut diags = Vec::new();
    let data = match split.yaml.map(frontmatter::parse) {
        Some(Ok(m)) => m,
        Some(Err(e)) => {
            diags.push(Diag::new(Level::Error, 1, "frontmatter", e));
            Map::new()
        }
        None => Map::new(),
    };

    // Identity: `name.md` or `name.<lang>.md`; frontmatter `id` / `lang` win.
    let file = path.rsplit('/').next().unwrap_or(path);
    let stem = file.strip_suffix(".md").unwrap_or(file);
    let (stem_id, file_lang) = match stem.rsplit_once('.') {
        Some((s, l)) if cfg.locales.iter().any(|x| x == l) => (s, Some(l.to_string())),
        _ => (stem, None),
    };
    let lang = string(data.get("lang"))
        .or(file_lang)
        .unwrap_or_else(|| cfg.default_locale().to_string());
    let id = string(data.get("id")).unwrap_or_else(|| stem_id.to_string());
    let kind = string(data.get("type"))
        .or_else(|| cfg.type_for_path(path).map(str::to_string))
        .unwrap_or_else(|| "note".into());

    let mut ctx = Ctx {
        cfg,
        path: path.to_string(),
        lang: lang.clone(),
        line0: split.body_line,
        links: Vec::new(),
        blocks: Vec::new(),
        plugins: Vec::new(),
        queries: Vec::new(),
        assets: BTreeSet::new(),
        tags: BTreeSet::new(),
        diags,
    };

    // Frontmatter relations become links too.
    if let Some(Value::Object(rel)) = data.get("rel") {
        for (name, v) in rel {
            for target in list(Some(v)) {
                let target = unwrap_link(&target);
                if target.is_empty() {
                    continue;
                }
                let (_, t, heading, block) = parse_target(&target);
                ctx.links.push(LinkRef {
                    target: t,
                    rel: Some(name.to_lowercase()),
                    heading,
                    block,
                    label: None,
                    origin: Origin::Frontmatter,
                    line: 1,
                    context: String::new(),
                });
            }
        }
    }
    for t in list(data.get("tags")) {
        let t = t.trim_start_matches('#').to_string();
        if valid_tag(&t) {
            ctx.tags.insert(t);
        }
    }

    let arena = Arena::new();
    let opts = comrak_options();
    let root = parse_document(&arena, split.body, &opts);

    // Search text and summary come from the untouched tree.
    let mut lines = Vec::new();
    let mut summary_src = None;
    for n in root.descendants() {
        let v = &n.data().value;
        let t = match v {
            NodeValue::CodeBlock(cb) => cb.literal.clone(),
            v if is_leaf_block(v) => plain(n),
            _ => continue,
        };
        let t = text::squash(&t);
        if t.is_empty() {
            continue;
        }
        if summary_src.is_none()
            && matches!(n.data().value, NodeValue::Paragraph)
            && !t.starts_with("![[")
            && leaf_block(n).is_some()
            && !n.ancestors().any(|a| {
                matches!(
                    a.data().value,
                    NodeValue::BlockQuote | NodeValue::BlockDirective(_)
                )
            })
        {
            summary_src = Some(t.clone());
        }
        lines.push(t);
    }
    let search_text = lines.join("\n");

    let headings = collect_headings(root, &ctx);
    pass_block_ids(&arena, root, &mut ctx);
    pass_embeds(&arena, root, &mut ctx);
    pass_links(&arena, root, &mut ctx);
    pass_images(root, &mut ctx);
    pass_tags(&arena, root, &mut ctx);
    pass_callouts(root, &mut ctx);
    pass_directives(root, &mut ctx);
    pass_code(&arena, root, &mut ctx);
    pass_math(&arena, root, &mut ctx);

    let html = render::render(
        root,
        &opts,
        headings.iter().map(|h| h.slug.clone()).collect(),
    );

    let title = string(data.get("title"))
        .or_else(|| {
            headings
                .iter()
                .find(|h| h.depth == 1)
                .map(|h| h.text.clone())
        })
        .unwrap_or_else(|| id.clone());
    let summary = string(data.get("summary"))
        .or_else(|| string(data.get("description")))
        .unwrap_or_else(|| text::truncate(summary_src.as_deref().unwrap_or(""), 160));

    let mut tags: Vec<String> = ctx.tags.into_iter().collect();
    tags.sort();
    Note {
        key: text::key(&id),
        path: path.to_string(),
        id,
        lang,
        title,
        kind,
        aliases: list(data.get("aliases")),
        tags,
        status: string(data.get("status")),
        created: string(data.get("created")),
        updated: string(data.get("updated")),
        reviewed: string(data.get("reviewed")),
        summary,
        hash,
        translation_of_hash: string(data.get("translation-of-hash")),
        words: text::word_count(&search_text),
        text: search_text,
        data,
        html,
        links: ctx.links,
        headings,
        blocks: ctx.blocks,
        plugins: ctx.plugins,
        queries: ctx.queries,
        assets: ctx.assets.into_iter().collect(),
        body_line: split.body_line,
        diags: ctx.diags,
    }
}

fn collect_headings(root: N<'_>, ctx: &Ctx) -> Vec<Heading> {
    let mut anchorizer = Anchorizer::new();
    let mut out = Vec::new();
    for n in root.descendants() {
        let level = match &n.data().value {
            NodeValue::Heading(h) => h.level,
            _ => continue,
        };
        let t = text::squash(&plain(n));
        let slug = anchorizer.anchorize(&t);
        out.push(Heading {
            depth: level,
            text: t,
            slug,
            line: line_of(n, ctx),
        });
    }
    out
}

/// `text ^block-id` at the end of a paragraph, or `^block-id` alone on the
/// line after a block (Obsidian puts it there after lists and tables).
fn pass_block_ids<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let paras: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::Paragraph))
        .collect();
    for p in paras {
        let Some(last) = p.last_child() else { continue };
        let found = {
            let d = last.data();
            match &d.value {
                NodeValue::Text(t) => {
                    trailing_block_id(t).map(|(cut, id)| (t[..cut].to_string(), id))
                }
                _ => None,
            }
        };
        let Some((kept, id)) = found else { continue };
        let line = line_of(p, ctx);
        let anchor = format!(
            "<span class=\"block-anchor\" id=\"b-{}\"></span>",
            escape(&id)
        );
        let kept_empty = kept.trim().is_empty();
        if kept_empty && p.children().count() == 1 {
            // `^id` on its own: it names the previous block.
            if let Some(prev) = p.previous_sibling() {
                ctx.blocks.push(BlockRef {
                    id,
                    text: text::truncate(&text::squash(&plain(prev)), 200),
                    line,
                });
                prev.insert_before(raw(arena, anchor + "\n"));
                p.detach();
                continue;
            }
        }
        last.data_mut().value = NodeValue::Text(Cow::Owned(kept.trim_end().to_string()));
        ctx.blocks.push(BlockRef {
            id,
            text: text::truncate(&text::squash(&plain(p)), 200),
            line,
        });
        p.prepend(raw(arena, anchor));
    }
}

fn trailing_block_id(t: &str) -> Option<(usize, String)> {
    let trimmed = t.trim_end();
    let caret = trimmed.rfind('^')?;
    let id = &trimmed[caret + 1..];
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    let before = &trimmed[..caret];
    if !before.is_empty() && !before.ends_with(char::is_whitespace) {
        return None;
    }
    Some((caret, id.to_string()))
}

/// A paragraph that is only `![[target]]` becomes an embed.
fn pass_embeds<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let paras: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::Paragraph))
        .collect();
    for p in paras {
        if !p
            .children()
            .all(|c| matches!(c.data().value, NodeValue::Text(_)))
        {
            continue;
        }
        let t = plain(p);
        let t = t.trim();
        let Some(inner) = t.strip_prefix("![[").and_then(|x| x.strip_suffix("]]")) else {
            continue;
        };
        if inner.contains("]]") {
            continue;
        }
        let (target_part, label) = match inner.split_once('|') {
            Some((a, b)) => (a, Some(b.trim().to_string())),
            None => (inner, None),
        };
        let (_, target, heading, block) = parse_target(target_part);
        let line = line_of(p, ctx);
        let ext = target.rsplit('.').next().unwrap_or("").to_lowercase();
        if target.contains('.') && IMAGE_EXT.contains(&ext.as_str()) {
            let asset = if target.contains('/') {
                normalise_path(&format!("{}/{}", dir_of(&ctx.path), target))
            } else {
                target.clone()
            };
            let src = format!("{}_assets/{}", ctx.cfg.base, text::encode_path(&asset));
            let alt = label.clone().unwrap_or_else(|| target.clone());
            ctx.assets.insert(asset);
            p.insert_before(raw(
                arena,
                format!("<figure class=\"embed-image\"><img src=\"{}\" alt=\"{}\" loading=\"lazy\"></figure>\n", escape(&src), escape(&alt)),
            ));
            p.detach();
            continue;
        }
        let idx = ctx.links.len();
        ctx.links.push(LinkRef {
            target,
            rel: None,
            heading,
            block,
            label,
            origin: Origin::Embed,
            line,
            context: String::new(),
        });
        p.insert_before(raw(arena, marker(markers::EMBED, idx) + "\n"));
        p.detach();
    }
}

/// `[[…]]` and relative Markdown links to `.md` files become link markers.
fn pass_links<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let nodes: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::WikiLink(_) | NodeValue::Link(_)))
        .collect();
    // Read every link (and its context) before rewriting any of them.
    let mut found = Vec::new();
    for n in nodes {
        let (url, is_wiki) = match &n.data().value {
            NodeValue::WikiLink(w) => (w.url.clone(), true),
            NodeValue::Link(l) => (l.url.clone(), false),
            _ => continue,
        };
        let mut label_text = String::new();
        for c in n.children() {
            plain_into(c, &mut label_text);
        }
        let label_text = text::squash(&label_text);
        let shown = text::squash(&plain(n));
        let context = context_for(n, &shown);
        found.push((n, url, is_wiki, label_text, context));
    }
    for (n, url, is_wiki, label_text, context) in found {
        let line = line_of(n, ctx);
        let link = if is_wiki {
            let decoded = percent_decode(&url);
            let (rel, target, heading, block) = parse_target(&decoded);
            if target.is_empty() && heading.is_none() && block.is_none() {
                ctx.diags.push(Diag::new(
                    Level::Warning,
                    line,
                    "empty-link",
                    "empty [[ ]] link",
                ));
                // Show it as written instead of as a link.
                n.insert_before(text_node(arena, format!("[[{}]]", decoded)));
                n.detach();
                continue;
            }
            if let Some(r) = &rel {
                if ctx.cfg.relation(r).is_none() && ctx.cfg.inverse_of(r).is_none() {
                    ctx.diags.push(Diag::new(
                        Level::Warning,
                        line,
                        "unknown-relation",
                        format!("relation `{r}` is not declared in clio.toml"),
                    ));
                }
            }
            let label = (label_text != decoded.trim() && !label_text.is_empty())
                .then(|| label_text.clone());
            LinkRef {
                target,
                rel,
                heading,
                block,
                label,
                origin: Origin::Wiki,
                line,
                context,
            }
        } else {
            if url.is_empty() || url.starts_with('#') || url.starts_with('/') || is_external(&url) {
                continue;
            }
            let (path_part, frag) = match url.split_once('#') {
                Some((a, b)) => (a, Some(percent_decode(b))),
                None => (url.as_str(), None),
            };
            let path_part = percent_decode(path_part);
            let ext = path_part.rsplit_once('.').map(|(_, e)| e.to_lowercase());
            if ext.as_deref().is_some_and(|e| e != "md") {
                continue; // a file, not a note
            }
            let joined = normalise_path(&format!("{}/{}", dir_of(&ctx.path), path_part));
            let target = joined.strip_suffix(".md").unwrap_or(&joined).to_string();
            LinkRef {
                target,
                rel: None,
                heading: frag,
                block: None,
                label: Some(label_text.clone()).filter(|l| !l.is_empty()),
                origin: Origin::Markdown,
                line,
                context,
            }
        };
        let idx = ctx.links.len();
        let auto = link.label.is_none();
        ctx.links.push(link);
        n.data_mut().value = NodeValue::WikiLink(NodeWikiLink {
            url: idx.to_string(),
        });
        if auto {
            let kids: Vec<N<'a>> = n.children().collect();
            for k in kids {
                k.detach();
            }
            n.append(raw(arena, marker(markers::LINK_TEXT, idx)));
        }
    }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    };
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(h * 16 + l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|_| s.to_string())
}

/// Relative image paths point into the vault; serve them from `_assets/`.
fn pass_images(root: N<'_>, ctx: &mut Ctx) {
    for n in root.descendants() {
        let mut d = n.data_mut();
        if let NodeValue::Image(img) = &mut d.value {
            if img.url.is_empty() || is_external(&img.url) || img.url.starts_with('/') {
                continue;
            }
            let path = normalise_path(&format!(
                "{}/{}",
                dir_of(&ctx.path),
                percent_decode(&img.url)
            ));
            img.url = format!("{}_assets/{}", ctx.cfg.base, text::encode_path(&path));
            ctx.assets.insert(path);
        }
    }
}

fn pass_tags<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let nodes: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(&n.data().value, NodeValue::Text(t) if t.contains('#')))
        .filter(|n| {
            !n.ancestors().skip(1).any(|a| {
                matches!(
                    a.data().value,
                    NodeValue::Link(_)
                        | NodeValue::WikiLink(_)
                        | NodeValue::Image(_)
                        | NodeValue::Heading(_)
                )
            })
        })
        .collect();
    let prefix = ctx.cfg.prefix(&ctx.lang);
    for n in nodes {
        let t = match &n.data().value {
            NodeValue::Text(t) => t.to_string(),
            _ => continue,
        };
        let parts = split_tags(&t);
        if !parts.iter().any(|(is_tag, _)| *is_tag) {
            continue;
        }
        for (is_tag, s) in parts {
            if is_tag {
                let href = format!("{}tags/{}", prefix, text::encode_path(&s));
                n.insert_before(raw(
                    arena,
                    format!(
                        "<a class=\"tag\" href=\"{}\">#{}</a>",
                        escape(&href),
                        escape(&s)
                    ),
                ));
                ctx.tags.insert(s);
            } else {
                n.insert_before(text_node(arena, s));
            }
        }
        n.detach();
    }
}

/// `> [!type]± title` blockquotes become callout nodes (a block directive the
/// renderer recognises by its info string).
fn pass_callouts(root: N<'_>, ctx: &mut Ctx) {
    let quotes: Vec<N<'_>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::BlockQuote))
        .collect();
    for q in quotes {
        let Some(p) = q.first_child() else { continue };
        if !matches!(p.data().value, NodeValue::Paragraph) {
            continue;
        }
        let Some(first) = p.first_child() else {
            continue;
        };
        let head = match &first.data().value {
            NodeValue::Text(t) if t.starts_with("[!") => t.to_string(),
            _ => continue,
        };
        let Some(close) = head.find(']') else {
            continue;
        };
        let kind = head[2..close].trim().to_lowercase();
        if kind.is_empty()
            || !kind
                .chars()
                .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
        {
            continue;
        }
        let mut rest = &head[close + 1..];
        let fold = if let Some(r) = rest.strip_prefix('-') {
            rest = r;
            "closed"
        } else if let Some(r) = rest.strip_prefix('+') {
            rest = r;
            "open"
        } else {
            ""
        };
        // Title: rest of the first line, including inline nodes up to the first line break.
        let mut title = rest.to_string();
        let mut to_remove = vec![first];
        let mut cur = first.next_sibling();
        while let Some(s) = cur {
            if matches!(s.data().value, NodeValue::SoftBreak | NodeValue::LineBreak) {
                to_remove.push(s);
                break;
            }
            title.push_str(&plain(s));
            to_remove.push(s);
            cur = s.next_sibling();
        }
        for r in to_remove {
            r.detach();
        }
        if p.first_child().is_none() {
            p.detach();
        }
        if !CALLOUTS.contains(&kind.as_str()) {
            ctx.diags.push(Diag::new(
                Level::Info,
                line_of(q, ctx),
                "callout-type",
                format!("custom callout type `{kind}`"),
            ));
        }
        let info = format!(
            "{CALLOUT_SEP}callout{CALLOUT_SEP}{kind}{CALLOUT_SEP}{fold}{CALLOUT_SEP}{}",
            text::squash(&title)
        );
        q.data_mut().value = NodeValue::BlockDirective(Box::new(NodeBlockDirective {
            fence_length: 3,
            fence_offset: 0,
            info,
        }));
    }
}

/// `:::note` style admonitions become callouts; unknown names get a warning.
fn pass_directives(root: N<'_>, ctx: &mut Ctx) {
    let nodes: Vec<N<'_>> = root
        .descendants()
        .filter(|n| matches!(&n.data().value, NodeValue::BlockDirective(d) if !d.info.starts_with(CALLOUT_SEP)))
        .collect();
    for n in nodes {
        let info = match &n.data().value {
            NodeValue::BlockDirective(d) => d.info.clone(),
            _ => continue,
        };
        let d = parse_directive(&info);
        if CALLOUTS.contains(&d.name.as_str()) {
            let fold = match d.attr("fold") {
                Some("closed") | Some("true") => "closed",
                Some("open") => "open",
                _ => "",
            };
            let title = d.title().unwrap_or_default();
            let new_info = format!(
                "{CALLOUT_SEP}callout{CALLOUT_SEP}{}{CALLOUT_SEP}{fold}{CALLOUT_SEP}{title}",
                d.name
            );
            if let NodeValue::BlockDirective(bd) = &mut n.data_mut().value {
                bd.info = new_info;
            }
        } else if !DIRECTIVES.contains(&d.name.as_str()) {
            ctx.diags.push(Diag::new(
                Level::Warning,
                line_of(n, ctx),
                "unknown-directive",
                format!(
                    "unknown directive `:::{}`; it renders as a plain block",
                    d.name
                ),
            ));
        }
    }
}

fn pass_code<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let nodes: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::CodeBlock(_)))
        .collect();
    for n in nodes {
        let (info, body) = match &n.data().value {
            NodeValue::CodeBlock(cb) => (cb.info.clone(), cb.literal.clone()),
            _ => continue,
        };
        let line = line_of(n, ctx);
        let (lang, title, highlight, attrs) = parse_info(&info);
        let replacement = if lang == "clio-query" || lang == "query" {
            let idx = ctx.queries.len();
            ctx.queries.push(QueryBlock { source: body, line });
            marker(markers::QUERY, idx)
        } else {
            let kind = match lang.as_str() {
                "mermaid" => "mermaid",
                "chart" => "chart",
                "math" | "latex" | "tex" => "math",
                _ => "code",
            };
            let fallback = match kind {
                "mermaid" => format!("<pre class=\"mermaid\">{}</pre>", escape(&body)),
                "math" => format!("<div class=\"math math-display\">{}</div>", escape(&body)),
                "chart" => format!("<pre class=\"chart-source\">{}</pre>", escape(&body)),
                _ => code_fallback(&lang, &title, &body),
            };
            let idx = ctx.plugins.len();
            ctx.plugins.push(PluginBlock {
                kind: kind.into(),
                lang: lang.clone(),
                title,
                highlight,
                attrs,
                display: true,
                text: body,
                fallback,
                line,
            });
            marker(markers::PLUGIN, idx)
        };
        n.insert_before(raw(arena, replacement + "\n"));
        n.detach();
    }
}

fn pass_math<'a>(arena: &'a Arena<'a>, root: N<'a>, ctx: &mut Ctx) {
    let nodes: Vec<N<'a>> = root
        .descendants()
        .filter(|n| matches!(n.data().value, NodeValue::Math(_)))
        .collect();
    for n in nodes {
        let (display, body) = match &n.data().value {
            NodeValue::Math(m) => (m.display_math, m.literal.clone()),
            _ => continue,
        };
        let cls = if display {
            "math math-display"
        } else {
            "math math-inline"
        };
        let idx = ctx.plugins.len();
        ctx.plugins.push(PluginBlock {
            kind: "math".into(),
            lang: "tex".into(),
            title: None,
            highlight: Vec::new(),
            attrs: Map::new(),
            display,
            fallback: format!("<span class=\"{cls}\">{}</span>", escape(&body)),
            text: body,
            line: line_of(n, ctx),
        });
        n.insert_before(raw(arena, marker(markers::PLUGIN, idx)));
        n.detach();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn targets() {
        assert_eq!(
            parse_target("depends-on::tokenizer#用法^b1"),
            (
                Some("depends-on".into()),
                "tokenizer".into(),
                Some("用法".into()),
                Some("b1".into())
            )
        );
        assert_eq!(parse_target("note"), (None, "note".into(), None, None));
        assert_eq!(parse_target("a::b::c").1, "b::c");
    }

    #[test]
    fn directives() {
        let d = parse_directive("tab{title=\"Rust 代码\" .wide #x} 其余");
        assert_eq!(d.name, "tab");
        assert_eq!(d.attr("title"), Some("Rust 代码"));
        assert_eq!(d.classes, vec!["wide"]);
        assert_eq!(d.id.as_deref(), Some("x"));
        assert_eq!(d.rest, "其余");
    }

    #[test]
    fn code_info() {
        let (lang, title, hl, _) = parse_info("rust title=\"src/lib.rs\" {1,3-5}");
        assert_eq!(lang, "rust");
        assert_eq!(title.as_deref(), Some("src/lib.rs"));
        assert_eq!(hl, vec![1, 3, 4, 5]);
    }

    #[test]
    fn tags_split() {
        let parts = split_tags("见 #rust/async，和 #2024 以及 #知识库");
        let tags: Vec<_> = parts
            .iter()
            .filter(|(t, _)| *t)
            .map(|(_, s)| s.as_str())
            .collect();
        assert_eq!(tags, vec!["rust/async", "知识库"]);
    }

    #[test]
    fn paths() {
        assert_eq!(normalise_path("notes/a/../b/./c.md"), "notes/b/c.md");
        assert_eq!(percent_decode("%E4%B8%8A"), "上");
    }
}
