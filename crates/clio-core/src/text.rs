//! Small text helpers shared by the engine. All of them are deterministic and
//! independent of platform word size, so native and WebAssembly builds agree.

/// HTML-escape text for element content and double-quoted attributes.
pub fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 8);
    for c in s.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            _ => out.push(c),
        }
    }
    out
}

/// Percent-encode one URL path segment (keeps unreserved ASCII, encodes the rest, including `/`).
pub fn encode_segment(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~') {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{b:02X}"));
        }
    }
    out
}

/// Percent-encode a path, keeping `/` separators.
pub fn encode_path(s: &str) -> String {
    s.split('/')
        .map(encode_segment)
        .collect::<Vec<_>>()
        .join("/")
}

/// Key used to match link targets: trimmed, lowercased, inner whitespace collapsed to `-`.
pub fn key(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut dash = false;
    for c in s.trim().chars() {
        if c.is_whitespace() || c == '_' {
            if !dash && !out.is_empty() {
                out.push('-');
                dash = true;
            }
        } else {
            for l in c.to_lowercase() {
                out.push(l);
            }
            dash = false;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

/// CJK ideographs, kana and hangul count as one word each; runs of other
/// alphanumerics count as one word.
pub fn word_count(s: &str) -> u32 {
    let mut n = 0u32;
    let mut in_word = false;
    for c in s.chars() {
        if is_cjk(c) {
            n += 1;
            in_word = false;
        } else if c.is_alphanumeric() {
            if !in_word {
                n += 1;
                in_word = true;
            }
        } else {
            in_word = false;
        }
    }
    n
}

pub fn is_cjk(c: char) -> bool {
    matches!(c as u32,
        0x3040..=0x30FF | 0x3400..=0x4DBF | 0x4E00..=0x9FFF | 0xAC00..=0xD7AF | 0xF900..=0xFAFF | 0x20000..=0x2FA1F)
}

/// Shorten to at most `max` characters, cutting at a character boundary and adding `…`.
pub fn truncate(s: &str, max: usize) -> String {
    let s = s.trim();
    if s.chars().count() <= max {
        return s.to_string();
    }
    let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
    out = out.trim_end().to_string();
    out.push('…');
    out
}

/// A window of `width` characters around byte offset `at`.
pub fn around(s: &str, at: usize, width: usize) -> String {
    let chars: Vec<(usize, char)> = s.char_indices().collect();
    if chars.len() <= width {
        return s.trim().to_string();
    }
    let idx = chars
        .iter()
        .position(|(b, _)| *b >= at)
        .unwrap_or(chars.len() - 1);
    let start = idx.saturating_sub(width / 3);
    let end = (start + width).min(chars.len());
    let start = end.saturating_sub(width);
    let mut out = String::new();
    if start > 0 {
        out.push('…');
    }
    out.extend(chars[start..end].iter().map(|(_, c)| *c));
    if end < chars.len() {
        out.push('…');
    }
    out.trim().to_string()
}

/// Collapse runs of whitespace to single spaces.
pub fn squash(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut space = false;
    for c in s.chars() {
        if c.is_whitespace() {
            if !space && !out.is_empty() {
                out.push(' ');
            }
            space = true;
        } else {
            out.push(c);
            space = false;
        }
    }
    if out.ends_with(' ') {
        out.pop();
    }
    out
}

/// FNV-1a, 64 bit; stable across platforms. Used for content hashes.
pub fn hash64(bytes: &[u8]) -> u64 {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for b in bytes {
        h ^= *b as u64;
        h = h.wrapping_mul(0x0000_0100_0000_01b3);
    }
    h
}

pub fn hash_hex(s: &str) -> String {
    format!("{:012x}", hash64(s.as_bytes()) >> 16)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_ignore_case_and_spacing() {
        assert_eq!(key("  Pratt   Parser "), "pratt-parser");
        assert_eq!(key("snake_case_id"), "snake-case-id");
        assert_eq!(key("上下文 工程"), "上下文-工程");
    }

    #[test]
    fn counts_cjk_per_character() {
        assert_eq!(word_count("上下文工程 is fun"), 7);
    }

    #[test]
    fn encodes_segments() {
        assert_eq!(encode_segment("上下"), "%E4%B8%8A%E4%B8%8B");
        assert_eq!(encode_path("a b/c"), "a%20b/c");
    }

    #[test]
    fn truncates_by_character() {
        assert_eq!(truncate("一二三四五六", 4), "一二三…");
        assert_eq!(around("abcdefghij", 5, 4), "…efgh…");
    }
}
