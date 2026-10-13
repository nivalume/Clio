//! Clio engine core: parses Clio Markdown, resolves links across a vault,
//! builds the knowledge graph and the site's data files. Deterministic and
//! free of I/O, so the same code runs natively and as WebAssembly.

pub mod api;
pub mod config;
pub mod frontmatter;
pub mod graph;
pub mod markers;
pub mod note;
pub mod query;
pub mod render;
pub mod search;
pub mod text;
pub mod vault;

pub use api::Engine;
pub use config::Config;
pub use note::{parse_note, Note};

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}
