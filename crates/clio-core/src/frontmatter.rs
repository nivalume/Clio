//! YAML frontmatter: `---` on the first line, `---` (or `...`) to close.

use serde_json::{Map, Value};

pub struct Split<'a> {
    pub yaml: Option<&'a str>,
    pub body: &'a str,
    /// 1-based line of the body's first line in the file.
    pub body_line: u32,
}

pub fn split(text: &str) -> Split<'_> {
    let rest = match text
        .strip_prefix("---\n")
        .or_else(|| text.strip_prefix("---\r\n"))
    {
        Some(r) => r,
        None => {
            return Split {
                yaml: None,
                body: text,
                body_line: 1,
            }
        }
    };
    let mut offset = 0;
    for line in rest.split_inclusive('\n') {
        let trimmed = line.trim_end_matches(['\n', '\r']);
        if trimmed == "---" || trimmed == "..." {
            let yaml = &rest[..offset];
            let body = &rest[offset + line.len()..];
            let body_line = 2 + yaml.matches('\n').count() as u32 + 1;
            return Split {
                yaml: Some(yaml),
                body,
                body_line,
            };
        }
        offset += line.len();
    }
    // No closing fence: treat the whole file as body.
    Split {
        yaml: None,
        body: text,
        body_line: 1,
    }
}

pub fn parse(yaml: &str) -> Result<Map<String, Value>, String> {
    if yaml.trim().is_empty() {
        return Ok(Map::new());
    }
    match serde_saphyr::from_str::<Value>(yaml) {
        Ok(Value::Object(map)) => Ok(map),
        Ok(Value::Null) => Ok(Map::new()),
        Ok(_) => Err("frontmatter must be a mapping of keys to values".into()),
        Err(e) => {
            let msg = e.to_string();
            let first = msg
                .lines()
                .next()
                .unwrap_or("")
                .trim_start_matches("error: ");
            Err(format!("invalid YAML: {first}"))
        }
    }
}

/// A frontmatter value as a string (numbers and booleans are stringified).
pub fn string(v: Option<&Value>) -> Option<String> {
    match v? {
        Value::String(s) => Some(s.trim().to_string()).filter(|s| !s.is_empty()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        _ => None,
    }
}

/// A frontmatter value as a list of strings: a sequence, or one string split on commas.
pub fn list(v: Option<&Value>) -> Vec<String> {
    match v {
        Some(Value::Array(items)) => items.iter().filter_map(|x| string(Some(x))).collect(),
        Some(Value::String(s)) => s
            .split(',')
            .map(|x| x.trim().to_string())
            .filter(|x| !x.is_empty())
            .collect(),
        Some(other) => string(Some(other)).into_iter().collect(),
        None => Vec::new(),
    }
}

/// `[[target]]`, `"[[target]]"` or plain `target` → `target`.
pub fn unwrap_link(s: &str) -> String {
    let t = s.trim();
    let t = t
        .strip_prefix("[[")
        .and_then(|x| x.strip_suffix("]]"))
        .unwrap_or(t);
    t.split('|').next().unwrap_or(t).trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_and_counts_lines() {
        let s = split("---\ntitle: a\ntags: [x]\n---\n# Body\n");
        assert_eq!(s.yaml, Some("title: a\ntags: [x]\n"));
        assert_eq!(s.body, "# Body\n");
        assert_eq!(s.body_line, 5);
    }

    #[test]
    fn no_frontmatter() {
        let s = split("# Only body\n");
        assert!(s.yaml.is_none());
        assert_eq!(s.body_line, 1);
    }

    #[test]
    fn parses_yaml_dates_as_strings() {
        let m = parse("updated: 2026-10-13\nrel:\n  depends-on: [a, \"[[b]]\"]\n").unwrap();
        assert_eq!(string(m.get("updated")).as_deref(), Some("2026-10-13"));
        let deps = list(m.get("rel").and_then(|r| r.get("depends-on")));
        assert_eq!(
            deps.iter().map(|d| unwrap_link(d)).collect::<Vec<_>>(),
            vec!["a", "b"]
        );
    }

    #[test]
    fn reports_bad_yaml() {
        assert!(parse("title: [unclosed\n").is_err());
        assert!(parse("- a\n- b\n").is_err());
    }
}
