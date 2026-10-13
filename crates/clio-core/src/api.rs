//! The engine as a JSON command processor, shared by the WebAssembly module
//! and the native binary so both behave identically.
//!
//! State: the configuration and every note, keyed by vault-relative path.
//! Commands are JSON objects with a `cmd` field; replies are JSON.

use crate::config::Config;
use crate::note::{parse_note, Note};
use serde_json::{json, Value};
use std::collections::BTreeMap;

#[derive(Default)]
pub struct Engine {
    pub cfg: Config,
    pub notes: BTreeMap<String, Note>,
}

impl Engine {
    pub fn new(cfg: Config) -> Self {
        Engine {
            cfg: cfg.normalised(),
            notes: BTreeMap::new(),
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
    }

    pub fn remove(&mut self, path: &str) {
        self.notes.remove(path);
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
            other => json!({ "error": format!("unknown command `{other}`") }),
        }
    }
}
