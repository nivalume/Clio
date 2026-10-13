//! HTML rendering: comrak's renderer with overrides for headings (ids and
//! section markers), link markers, callouts and directives.

use crate::markers::{self, marker};
use crate::note::{parse_directive, CALLOUT_SEP};
use crate::text::escape;
use comrak::create_formatter;
use comrak::nodes::{AstNode, NodeValue};
use comrak::Options;
use std::fmt::Write;

#[derive(Default)]
pub struct State {
    slugs: Vec<String>,
    next_heading: usize,
    current: Vec<(u8, usize)>,
}

/// Default callout titles when the source gives none.
pub fn callout_label(kind: &str) -> &'static str {
    match kind {
        "note" => "Note",
        "abstract" | "summary" => "Summary",
        "info" => "Info",
        "todo" => "Todo",
        "tip" | "hint" => "Tip",
        "important" => "Important",
        "success" => "Success",
        "question" => "Question",
        "warning" | "attention" => "Warning",
        "caution" => "Caution",
        "failure" => "Failure",
        "danger" | "error" => "Danger",
        "bug" => "Bug",
        "example" => "Example",
        "quote" => "Quote",
        _ => "Note",
    }
}

fn callout_open(kind: &str, fold: &str, title: &str) -> String {
    let label = if title.is_empty() {
        callout_label(kind).to_string()
    } else {
        title.to_string()
    };
    let kind_attr = escape(kind);
    let title_html = format!(
        "<span class=\"callout-icon\" aria-hidden=\"true\"></span><span class=\"callout-label\">{}</span>",
        escape(&label)
    );
    match fold {
        "closed" | "open" => format!(
            "<details class=\"callout\" data-callout=\"{kind_attr}\"{}><summary class=\"callout-title\">{title_html}</summary><div class=\"callout-body\">\n",
            if fold == "open" { " open" } else { "" }
        ),
        _ => format!(
            "<div class=\"callout\" data-callout=\"{kind_attr}\"><div class=\"callout-title\">{title_html}</div><div class=\"callout-body\">\n"
        ),
    }
}

fn callout_close(fold: &str) -> &'static str {
    match fold {
        "closed" | "open" => "</div></details>\n",
        _ => "</div></div>\n",
    }
}

fn directive_open<'a>(node: &'a AstNode<'a>, info: &str) -> String {
    let d = parse_directive(info);
    let mut classes = format!("directive directive-{}", escape(&d.name));
    for c in &d.classes {
        classes.push(' ');
        classes.push_str(&escape(c));
    }
    let id =
        d.id.as_ref()
            .map(|i| format!(" id=\"{}\"", escape(i)))
            .unwrap_or_default();
    match d.name.as_str() {
        "tabs" => {
            let mut bar = String::new();
            let mut i = 0;
            for child in node.children() {
                if let NodeValue::BlockDirective(cd) = &child.data().value {
                    let ci = parse_directive(&cd.info);
                    if ci.name == "tab" {
                        let title = ci.title().unwrap_or_else(|| format!("{}", i + 1));
                        bar.push_str(&format!(
                            "<button type=\"button\" role=\"tab\" class=\"tab-button\" aria-selected=\"{}\" data-tab=\"{i}\">{}</button>",
                            i == 0,
                            escape(&title)
                        ));
                        i += 1;
                    }
                }
            }
            format!("<div class=\"{classes}\"{id} data-tabs><div class=\"tabs-bar\" role=\"tablist\">{bar}</div>\n")
        }
        "tab" => {
            let title = d.title().unwrap_or_default();
            format!(
                "<section class=\"{classes}\" role=\"tabpanel\" data-title=\"{}\">\n",
                escape(&title)
            )
        }
        "details" => {
            let title = d.title().unwrap_or_else(|| "Details".into());
            let open = if d.attr("open").is_some() {
                " open"
            } else {
                ""
            };
            format!(
                "<details class=\"{classes}\"{id}{open}><summary>{}</summary>\n",
                escape(&title)
            )
        }
        "card" => {
            let mut out = format!("<div class=\"{classes}\"{id}>\n");
            if let Some(t) = d.title() {
                out.push_str(&format!("<div class=\"card-title\">{}</div>\n", escape(&t)));
            }
            out
        }
        "column" => {
            let width = d
                .attr("width")
                .map(|w| format!(" style=\"flex:{}\"", escape(w)))
                .unwrap_or_default();
            format!("<div class=\"{classes}\"{id}{width}>\n")
        }
        _ => {
            let title = d
                .title()
                .filter(|_| matches!(d.name.as_str(), "steps" | "cards" | "columns"));
            let mut out = format!("<div class=\"{classes}\"{id}>\n");
            if let Some(t) = title {
                out.push_str(&format!(
                    "<div class=\"directive-title\">{}</div>\n",
                    escape(&t)
                ));
            }
            out
        }
    }
}

fn directive_close(info: &str) -> &'static str {
    match parse_directive(info).name.as_str() {
        "tab" => "</section>\n",
        "details" => "</details>\n",
        _ => "</div>\n",
    }
}

create_formatter!(ClioHtml<State>, {
    NodeValue::Heading(ref nh) => |context, entering| {
        if entering {
            let idx = context.user.next_heading;
            context.user.next_heading += 1;
            context.user.current.push((nh.level, idx));
            let slug = context.user.slugs.get(idx).cloned().unwrap_or_default();
            context.cr()?;
            context.write_str(&marker(markers::HEADING, idx))?;
            write!(context, "<h{} id=\"{}\">", nh.level, escape(&slug))?;
        } else {
            let (level, idx) = context.user.current.pop().unwrap_or((nh.level, 0));
            let slug = context.user.slugs.get(idx).cloned().unwrap_or_default();
            writeln!(context, "<a class=\"anchor\" href=\"#{}\" aria-hidden=\"true\">#</a></h{}>", escape(&slug), level)?;
        }
    },
    NodeValue::WikiLink(ref wl) => |context, entering| {
        if entering {
            let idx = wl.url.parse::<usize>().unwrap_or(usize::MAX);
            context.write_str(&marker(markers::LINK, idx))?;
        } else {
            context.write_str("</a>")?;
        }
    },
    NodeValue::BlockDirective(ref nd) => |context, node, entering| {
        if let Some(rest) = nd.info.strip_prefix(CALLOUT_SEP) {
            let mut parts = rest.split(CALLOUT_SEP);
            let _ = parts.next();
            let kind = parts.next().unwrap_or("note");
            let fold = parts.next().unwrap_or("");
            let title = parts.next().unwrap_or("");
            if entering {
                context.cr()?;
                context.write_str(&callout_open(kind, fold, title))?;
            } else {
                context.write_str(callout_close(fold))?;
            }
        } else if entering {
            context.cr()?;
            context.write_str(&directive_open(node, &nd.info))?;
        } else {
            context.write_str(directive_close(&nd.info))?;
        }
    },
});

pub fn render<'a>(root: &'a AstNode<'a>, options: &Options, slugs: Vec<String>) -> String {
    let mut out = String::new();
    let state = State {
        slugs,
        ..State::default()
    };
    let _ = ClioHtml::format_document(root, options, &mut out, state);
    out
}
