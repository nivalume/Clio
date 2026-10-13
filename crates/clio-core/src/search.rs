//! In-memory BM25 search for the CLI and agents (`clio search`). The web site
//! uses Pagefind; this index exists so read commands answer without a browser.
//!
//! Tokens: lowercase alphanumeric runs for Latin text; for CJK text every
//! single character and every adjacent pair (so two-character words match and
//! single-character queries still work).

use crate::text::is_cjk;
use std::collections::BTreeMap;

pub fn tokens(s: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut word = String::new();
    let mut prev_cjk: Option<char> = None;
    for c in s.chars() {
        if is_cjk(c) {
            if !word.is_empty() {
                out.push(std::mem::take(&mut word));
            }
            out.push(c.to_string());
            if let Some(p) = prev_cjk {
                out.push(format!("{p}{c}"));
            }
            prev_cjk = Some(c);
        } else if c.is_alphanumeric() {
            prev_cjk = None;
            word.extend(c.to_lowercase());
        } else {
            prev_cjk = None;
            if !word.is_empty() {
                out.push(std::mem::take(&mut word));
            }
        }
    }
    if !word.is_empty() {
        out.push(word);
    }
    out
}

/// Field weights: title, aliases and tags, headings, body.
const WEIGHTS: [f64; 4] = [4.0, 2.5, 1.5, 1.0];

pub struct Doc<'a> {
    pub title: &'a str,
    pub aliases: String,
    pub headings: String,
    pub body: &'a str,
}

#[derive(Default)]
pub struct Index {
    /// token → (doc, weighted term frequency)
    postings: BTreeMap<String, Vec<(u32, f64)>>,
    lengths: Vec<f64>,
    avg: f64,
}

impl Index {
    pub fn build<'a>(docs: impl Iterator<Item = Doc<'a>>) -> Self {
        let mut postings: BTreeMap<String, Vec<(u32, f64)>> = BTreeMap::new();
        let mut lengths = Vec::new();
        for (i, d) in docs.enumerate() {
            let mut tf: BTreeMap<String, f64> = BTreeMap::new();
            let mut len = 0.0;
            for (field, text) in [d.title, d.aliases.as_str(), d.headings.as_str(), d.body]
                .iter()
                .enumerate()
            {
                for t in tokens(text) {
                    *tf.entry(t).or_insert(0.0) += WEIGHTS[field];
                    len += 1.0;
                }
            }
            for (t, f) in tf {
                postings.entry(t).or_default().push((i as u32, f));
            }
            lengths.push(len);
        }
        let avg = if lengths.is_empty() {
            1.0
        } else {
            lengths.iter().sum::<f64>() / lengths.len() as f64
        };
        Index {
            postings,
            lengths,
            avg: avg.max(1.0),
        }
    }

    /// Documents ranked by BM25 (k1 = 1.2, b = 0.75). Every query token must
    /// match (for CJK, the pairs carry the weight; single characters are optional).
    pub fn search(&self, query: &str, limit: usize) -> Vec<(u32, f64)> {
        let n = self.lengths.len() as f64;
        let toks = tokens(query);
        if toks.is_empty() {
            return Vec::new();
        }
        let has_pairs = toks
            .iter()
            .any(|t| t.chars().count() == 2 && t.chars().all(is_cjk));
        let mut scores: BTreeMap<u32, (f64, usize)> = BTreeMap::new();
        let mut required = 0usize;
        for t in &toks {
            let single_cjk = t.chars().count() == 1 && t.chars().all(is_cjk);
            let optional = single_cjk && has_pairs;
            if !optional {
                required += 1;
            }
            // Latin prefixes match too, for type-ahead.
            let lists: Vec<&Vec<(u32, f64)>> = if t.chars().all(is_cjk) {
                self.postings.get(t).into_iter().collect()
            } else {
                self.postings
                    .range(t.clone()..)
                    .take_while(|(k, _)| k.starts_with(t.as_str()))
                    .map(|(_, v)| v)
                    .collect()
            };
            let mut seen = std::collections::BTreeSet::new();
            for list in lists {
                let df = list.len() as f64;
                let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();
                for &(d, f) in list {
                    let len = self.lengths[d as usize];
                    let s = idf * f * 2.2 / (f + 1.2 * (1.0 - 0.75 + 0.75 * len / self.avg));
                    let e = scores.entry(d).or_insert((0.0, 0));
                    e.0 += s;
                    if !optional && seen.insert(d) {
                        e.1 += 1;
                    }
                }
            }
        }
        let mut hits: Vec<(u32, f64)> = scores
            .into_iter()
            .filter(|(_, (_, matched))| *matched >= required)
            .map(|(d, (s, _))| (d, s))
            .collect();
        hits.sort_by(|a, b| {
            b.1.partial_cmp(&a.1)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(a.0.cmp(&b.0))
        });
        hits.truncate(limit);
        hits
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tokenizes_mixed_text() {
        assert_eq!(
            tokens("Pratt 解析器!"),
            vec!["pratt", "解", "析", "解析", "器", "析器"]
        );
    }

    #[test]
    fn ranks_title_matches_first() {
        let docs = vec![
            Doc {
                title: "上下文工程",
                aliases: String::new(),
                headings: String::new(),
                body: "把知识整理成上下文",
            },
            Doc {
                title: "无关",
                aliases: String::new(),
                headings: String::new(),
                body: "提到一次上下文",
            },
            Doc {
                title: "Typed links",
                aliases: String::new(),
                headings: String::new(),
                body: "relations",
            },
        ];
        let idx = Index::build(docs.into_iter());
        let hits = idx.search("上下文", 10);
        assert_eq!(hits.iter().map(|h| h.0).collect::<Vec<_>>(), vec![0, 1]);
        assert_eq!(idx.search("typ", 10)[0].0, 2);
        assert!(idx.search("relations 上下文", 10).is_empty());
    }
}
