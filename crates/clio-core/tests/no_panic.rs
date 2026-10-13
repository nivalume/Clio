//! Random Markdown-shaped input must never panic the parser.
use clio_core::{parse_note, Config};

struct SplitMix(u64);
impl SplitMix {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
}

const PIECES: &[&str] = &[
    "[[",
    "]]",
    "|",
    "::",
    "#",
    "^",
    "!",
    "![[",
    "> [!note]",
    "> [!tip]-",
    "\n",
    "\n\n",
    ":::",
    "::::",
    "{",
    "}",
    "=\"",
    "```",
    "~~~",
    "$",
    "$$",
    "`",
    "*",
    "**",
    "_",
    "- ",
    "1. ",
    "| a | b |\n|---|---|\n",
    "---\n",
    "id: x\n",
    "rel:\n  a: [b]\n",
    "中文",
    "，",
    "。",
    "text",
    " ",
    "\t",
    "%E4",
    "%",
    "../",
    "a.md",
    "(",
    ")",
    "[x](y.md)",
    "\u{E000}",
    "\u{1}",
    "^id",
    "#tag/sub",
];

#[test]
fn random_inputs_do_not_panic() {
    let cfg = Config::default().normalised();
    let mut rng = SplitMix(42);
    for _ in 0..4000 {
        let len = (rng.next() % 60) as usize;
        let mut s = String::new();
        for _ in 0..len {
            s.push_str(PIECES[(rng.next() % PIECES.len() as u64) as usize]);
        }
        let note = parse_note("notes/x.md", &s, &cfg);
        assert!(!note.html.contains("\u{E000}L18446744073709551615"));
    }
}
