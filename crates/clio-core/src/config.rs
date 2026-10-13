//! Vault configuration. `clio.toml` is parsed on the Bun side (Bun reads TOML
//! natively) and handed to the engine as JSON; every field has a default so an
//! empty object is a valid configuration.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    /// Site title.
    pub title: String,
    /// URL path the site is served from, always starting and ending with `/`.
    pub base: String,
    /// Languages; the first is the default. More than one turns on `/<lang>/` routes.
    pub locales: Vec<String>,
    /// Note types in display order.
    pub types: Vec<TypeDef>,
    /// Folder prefix → type, for notes without `type:` in their frontmatter.
    pub folders: BTreeMap<String, String>,
    /// Relation vocabulary for typed links.
    pub relations: Vec<RelationDef>,
    /// A note whose `reviewed` (or `updated`) date is older than this is stale.
    pub stale_days: u32,
    /// Today, as `YYYY-MM-DD`; passed in so the engine never reads a clock.
    pub today: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct TypeDef {
    pub name: String,
    /// Label per language.
    pub label: BTreeMap<String, String>,
    /// Frontmatter fields every note of this type must have.
    pub required: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct RelationDef {
    pub name: String,
    /// Name of the reverse direction, e.g. `used-by` for `depends-on`.
    pub inverse: Option<String>,
    /// The relation reads the same both ways (`see-also`, `contradicts`).
    pub symmetric: bool,
    /// Label per language, for both directions: `{ zh = "依赖" }`.
    pub label: BTreeMap<String, String>,
    pub inverse_label: BTreeMap<String, String>,
}

fn labels(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect()
}

fn rel(
    name: &str,
    inverse: Option<&str>,
    symmetric: bool,
    zh: &str,
    en: &str,
    zh_inv: &str,
    en_inv: &str,
) -> RelationDef {
    RelationDef {
        name: name.into(),
        inverse: inverse.map(Into::into),
        symmetric,
        label: labels(&[("zh", zh), ("en", en)]),
        inverse_label: labels(&[("zh", zh_inv), ("en", en_inv)]),
    }
}

fn ty(name: &str, zh: &str, en: &str, required: &[&str]) -> TypeDef {
    TypeDef {
        name: name.into(),
        label: labels(&[("zh", zh), ("en", en)]),
        required: required.iter().map(|s| s.to_string()).collect(),
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            title: "Clio".into(),
            base: "/".into(),
            locales: vec!["zh".into()],
            types: vec![
                ty("topic", "主题", "Topic", &[]),
                ty("concept", "概念", "Concept", &[]),
                ty("entity", "实体", "Entity", &[]),
                ty("source", "来源", "Source", &[]),
                ty("question", "问答", "Question", &[]),
                ty("journal", "日志", "Journal", &[]),
                ty("note", "笔记", "Note", &[]),
            ],
            folders: [
                ("notes/topics/", "topic"),
                ("notes/concepts/", "concept"),
                ("notes/entities/", "entity"),
                ("notes/sources/", "source"),
                ("notes/questions/", "question"),
                ("journal/", "journal"),
            ]
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect(),
            relations: vec![
                rel(
                    "depends-on",
                    Some("used-by"),
                    false,
                    "依赖",
                    "depends on",
                    "被依赖",
                    "used by",
                ),
                rel(
                    "part-of",
                    Some("has-part"),
                    false,
                    "属于",
                    "part of",
                    "包含",
                    "has part",
                ),
                rel(
                    "supports",
                    Some("supported-by"),
                    false,
                    "支持",
                    "supports",
                    "被支持",
                    "supported by",
                ),
                rel(
                    "source",
                    Some("cited-by"),
                    false,
                    "来源",
                    "source",
                    "被引用",
                    "cited by",
                ),
                rel(
                    "extends",
                    Some("extended-by"),
                    false,
                    "扩展",
                    "extends",
                    "被扩展",
                    "extended by",
                ),
                rel(
                    "example-of",
                    Some("has-example"),
                    false,
                    "示例",
                    "example of",
                    "有示例",
                    "has example",
                ),
                rel(
                    "contradicts",
                    None,
                    true,
                    "矛盾",
                    "contradicts",
                    "矛盾",
                    "contradicts",
                ),
                rel(
                    "see-also", None, true, "参见", "see also", "参见", "see also",
                ),
            ],
            stale_days: 180,
            today: String::new(),
        }
    }
}

impl Config {
    pub fn default_locale(&self) -> &str {
        self.locales.first().map(String::as_str).unwrap_or("zh")
    }

    pub fn multilingual(&self) -> bool {
        self.locales.len() > 1
    }

    /// URL prefix for pages in `lang`: `/`, `/docs/`, `/en/`, `/docs/en/`.
    pub fn prefix(&self, lang: &str) -> String {
        if self.multilingual() {
            format!("{}{}/", self.base, lang)
        } else {
            self.base.clone()
        }
    }

    pub fn relation(&self, name: &str) -> Option<&RelationDef> {
        self.relations.iter().find(|r| r.name == name)
    }

    /// Is `name` an inverse name of some relation (`used-by`)? Returns the forward relation.
    pub fn inverse_of(&self, name: &str) -> Option<&RelationDef> {
        self.relations
            .iter()
            .find(|r| r.inverse.as_deref() == Some(name))
    }

    pub fn type_for_path(&self, path: &str) -> Option<&str> {
        self.folders
            .iter()
            .filter(|(prefix, _)| path.starts_with(prefix.as_str()))
            .max_by_key(|(prefix, _)| prefix.len())
            .map(|(_, t)| t.as_str())
    }

    /// Fill defaults that depend on other fields and normalise `base`.
    pub fn normalised(mut self) -> Self {
        if !self.base.starts_with('/') {
            self.base.insert(0, '/');
        }
        if !self.base.ends_with('/') {
            self.base.push('/');
        }
        if self.locales.is_empty() {
            self.locales.push("zh".into());
        }
        self
    }
}
