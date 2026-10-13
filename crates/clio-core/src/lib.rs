//! Clio engine core. P0 skeleton: Markdown → HTML with Clio's comrak options.

use comrak::{markdown_to_html, Options};

pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn comrak_options() -> Options<'static> {
    let mut o = Options::default();
    let e = &mut o.extension;
    e.strikethrough = true;
    e.table = true;
    e.autolink = true;
    e.tasklist = true;
    e.footnotes = true;
    e.description_lists = true;
    e.front_matter_delimiter = Some("---".into());
    e.math_dollars = true;
    e.wikilinks_title_after_pipe = true;
    e.cjk_friendly_emphasis = true;
    e.highlight = true;
    e.block_directive = true;
    o.render.r#unsafe = false;
    o
}

pub fn render(md: &str) -> String {
    markdown_to_html(md, &comrak_options())
}
