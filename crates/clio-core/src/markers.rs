//! Placeholders inside rendered HTML.
//!
//! A note is rendered once, before the rest of the vault is known. Anything
//! that depends on other notes (a link's target and title, an embed, a query
//! result) or on a Bun-side plugin (code highlighting, math, charts) is written
//! as a marker `U+E000 <kind> <index> U+E001` and filled in later. The two
//! characters are in the Unicode private-use area; input text has them replaced
//! with U+FFFD before parsing, so a marker can only come from the engine.

use std::borrow::Cow;

pub const OPEN: char = '\u{E000}';
pub const CLOSE: char = '\u{E001}';

/// Link open tag (`<a …>`), filled by the vault phase.
pub const LINK: char = 'L';
/// Link text when the source gave none (`[[id]]` shows the target's title).
pub const LINK_TEXT: char = 't';
/// Block embed `![[id#section]]`.
pub const EMBED: char = 'E';
/// Plugin block: code, math, mermaid, chart.
pub const PLUGIN: char = 'B';
/// `clio-query` block.
pub const QUERY: char = 'Q';
/// Start of a heading; used to cut sections for embeds, removed on output.
pub const HEADING: char = 'H';

pub fn marker(kind: char, n: usize) -> String {
    format!("{OPEN}{kind}{n}{CLOSE}")
}

/// Replace marker characters that appear in user input.
pub fn sanitize(input: &str) -> Cow<'_, str> {
    if input.contains(['\u{E000}', '\u{E001}']) {
        Cow::Owned(input.replace(['\u{E000}', '\u{E001}'], "\u{FFFD}"))
    } else {
        Cow::Borrowed(input)
    }
}

/// Replace every marker with `f(kind, index)`.
pub fn replace(html: &str, mut f: impl FnMut(char, usize) -> String) -> String {
    let mut out = String::with_capacity(html.len());
    let mut rest = html;
    while let Some(start) = rest.find(OPEN) {
        out.push_str(&rest[..start]);
        let after = &rest[start + OPEN.len_utf8()..];
        match after.find(CLOSE) {
            Some(end) => {
                let body = &after[..end];
                let mut chars = body.chars();
                let kind = chars.next().unwrap_or('?');
                let n = chars.as_str().parse::<usize>().unwrap_or(usize::MAX);
                out.push_str(&f(kind, n));
                rest = &after[end + CLOSE.len_utf8()..];
            }
            None => {
                rest = after;
            }
        }
    }
    out.push_str(rest);
    out
}

/// Byte offsets of every marker of `kind`, in order, with their index.
pub fn positions(html: &str, kind: char) -> Vec<(usize, usize, usize)> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(rel) = html[from..].find(OPEN) {
        let start = from + rel;
        let body_start = start + OPEN.len_utf8();
        let Some(end_rel) = html[body_start..].find(CLOSE) else {
            break;
        };
        let body = &html[body_start..body_start + end_rel];
        let end = body_start + end_rel + CLOSE.len_utf8();
        let mut chars = body.chars();
        if chars.next() == Some(kind) {
            if let Ok(n) = chars.as_str().parse::<usize>() {
                out.push((start, end, n));
            }
        }
        from = end;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let html = format!("a{}b{}c", marker(LINK, 3), marker(EMBED, 12));
        let out = replace(&html, |k, n| format!("[{k}{n}]"));
        assert_eq!(out, "a[L3]b[E12]c");
        assert_eq!(positions(&html, EMBED).len(), 1);
    }

    #[test]
    fn input_cannot_forge_markers() {
        assert_eq!(sanitize("x\u{E000}L1\u{E001}"), "x\u{FFFD}L1\u{FFFD}");
    }
}
