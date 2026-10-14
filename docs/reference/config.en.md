---
title: Configuration
summary: Every clio.toml key (type, default, example), the theme.css variables, and the clio.config.ts plugin interface.
tags: [config, reference]
rel:
  part-of: index
  see-also: [customizing, vault-layout]
updated: 2026-10-13
translation-of-hash: "b25cd4d02486"
---
# Configuration

A vault is configured in three places: `clio.toml` at the root (site, languages, types, relations, build), `theme/theme.css` (appearance) and `clio.config.ts` (render plugins). All three are optional; anything missing takes its default. For when and how to change them, see [[customizing]].

## Where clio.toml lives

`clio` searches upward from the current directory (or `--dir`) for `clio.toml`; its directory is the vault root. All paths — the keys of `[folders]`, the entries of `[build] ignore` — are relative to that directory and use `/`. The file is TOML, read by Bun's built-in parser.

An empty `clio.toml` is valid: every key has a default.

## Top-level keys

| Key | Type | Default | Meaning |
|---|---|---|---|
| `title` | string | `"Clio"` | Site title, shown in the top bar, the browser tab and `llms.txt` |
| `description` | string, or table: language → string | `""` | Site description, used on the home page and in `<meta name="description">`. As a table, each language gets its own description; a missing language uses the default language's |
| `base` | string | `"/"` | URL path the site is served from, e.g. `"/kb/"`. A missing leading or trailing `/` is added. `clio build --base` takes precedence; the generated GitHub Pages workflow passes the path that way, so GitHub Pages needs no change here |
| `locales` | array of strings | `["zh"]` | Languages; the first is the default. With more than one, URLs carry a language prefix: `/zh/n/<id>`, `/en/n/<id>` |
| `stale_days` | integer | `180` | Notes whose `reviewed` date (or `updated`, if there is none) is older than this get a `stale` notice |

```toml
title = "My knowledge base"
description = "Compilers, language models and the papers I have read"
base = "/kb/"
locales = ["en", "zh"]
stale_days = 365
```

With one description per language:

```toml
description = { zh = "编译器、语言模型和读过的论文", en = "Compilers, language models and the papers I have read" }
```

File naming and linking across languages are covered in [[multilingual]].

## site

`[site]` sets the repository link, the site's full address and the fonts.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `repo` | string (URL) | none | Source repository. When set, every page shows an "edit this page" link |
| `edit_path` | string | `""` | Path of the vault inside the repository, e.g. `"docs/"`; empty when the vault is the repository root |
| `url` | string (URL) | none | The site's absolute address, scheme and host only, e.g. `"https://kb.example.com"`; the path comes from `base`. When set, the build writes `sitemap.xml` and `robots.txt`, and every note page gets a `<link rel="canonical">` |
| `fonts` | boolean | `true` | When `false`, Space Grotesk and Space Mono are not loaded from Google Fonts; pages use whichever fonts from the `--font-text` and `--font-mono` lists are installed |

```toml
[site]
repo = "https://github.com/you/kb"
edit_path = ""
url = "https://kb.example.com"
fonts = false
```

## types

`[types.<name>]` adds a note type or changes a built-in one. Types are merged by name: naming a built-in type overrides only the fields you write.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `label` | table: language → string | the type name | Display name, one per language |
| `required` | array of strings | `[]` | Frontmatter fields every note of this type must have; a missing one gives a `required-field` warning |

```toml
[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary", "source"]

[types.source]          # built-in type: only change the required fields
required = ["raw"]
```

Built-in types and their default folders:

| Type | Chinese | English | Default folder |
|---|---|---|---|
| `topic` | 主题 | Topic | `notes/topics/` |
| `concept` | 概念 | Concept | `notes/concepts/` |
| `entity` | 实体 | Entity | `notes/entities/` |
| `source` | 来源 | Source | `notes/sources/` |
| `question` | 问答 | Question | `notes/questions/` |
| `journal` | 日志 | Journal | `journal/` |
| `note` | 笔记 | Note | anywhere else |

A note's type is, in order: `type` in its frontmatter; the `[folders]` mapping; `note`. Why folders hold types rather than topics is explained in [[information-architecture]].

## folders

`[folders]` maps folder prefixes to types, for notes without `type:`. Keys are path prefixes relative to the root and end with `/`; values are type names. Your entries are added on top of the built-in mapping and win on the same key. When a file matches several prefixes, the longest one applies.

```toml
[folders]
"notes/papers/" = "paper"
"guides/" = "guide"
```

Folders only decide where a file is stored and its default type. Note ids are global, so moving a file to another folder never breaks a link.

## relations

`[[relations]]` is an array of tables, one per relation. Entries are merged with the built-in relations by `name`; a matching name overrides the built-in definition.

| Key | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | required | Relation name, used in `[[name::id]]` and in frontmatter `rel:` |
| `inverse` | string | none | Name of the reverse direction, e.g. `used-by`. `[[inverse::id]]` is accepted too |
| `symmetric` | boolean | `false` | The relation reads the same both ways (like `see-also`); the target uses the same label |
| `label` | table: language → string | the name | Label shown on the source page |
| `inverse_label` | table: language → string | the name | Label shown on the target page |

```toml
[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }

[[relations]]
name = "alternative-to"
symmetric = true
label = { zh = "可替代", en = "alternative to" }
```

The built-in relations are listed in [[linking]]. An undeclared relation gives an `unknown-relation` warning.

## build

| Key | Type | Default | Meaning |
|---|---|---|---|
| `ignore` | array of strings | `[]` | Paths not read as notes, added after the default list |

```toml
[build]
ignore = ["drafts/private", "**/*.excalidraw.md"]
```

An entry without `*` matches that path and everything below it; an entry with `*` is a glob. Ignored by default: `.clio`, `.git`, `node_modules`, `.obsidian`, `.trash`, `dist`, `raw`, `templates`, `theme`, `skills`, `.claude`, `.agents`, `.github`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `log.md`. Any path containing `node_modules` is ignored as well.

`raw/` is ignored only in the sense that its files are not read as notes: `clio check` still verifies their hashes, and images in it can still be embedded.

## Full example

```toml
title = "My knowledge base"
description = "Compilers, language models and the papers I have read"
base = "/"
locales = ["en", "zh"]
stale_days = 180

[site]
repo = "https://github.com/you/kb"
edit_path = ""
url = "https://kb.example.com"

[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary"]

[folders]
"notes/papers/" = "paper"

[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }

[build]
ignore = ["drafts/private"]
```

## Theme

`theme/theme.css` is loaded after the default styles and overrides CSS variables. Write only the variables you want to change:

```css title="theme/theme.css"
:root {
  --tomato: #c6f432;     /* main buttons in neon green */
  --font-text: "Inter", "PingFang SC", system-ui, sans-serif;
}

/* dark theme, following the system */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #0d0f14;
  }
}

/* dark theme, chosen by the reader */
:root[data-theme="dark"] {
  --paper: #0d0f14;
}
```

The dark theme has two triggers — the system preference and the reader's choice in the interface — so a dark override goes in both places, as above. A variable set only in `:root` applies to both themes unless the default styles redefine it for dark mode (as they do for paper, ink, lines and cobalt).

| Variable | Light default | Used for |
|---|---|---|
| `--paper` | `#f2f0ea` | Page background (warm grey paper) |
| `--paper-2` | `#e9e6dd` | Secondary background: sidebars, inactive tabs, the metadata strip |
| `--card` | `#ffffff` | Cards and panel bodies |
| `--ink` | `#15151c` | Text, outlines, hard shadows |
| `--ink-2` | `#3a3a47` | Secondary text |
| `--muted` | `#61616f` | Metadata, placeholder text |
| `--line` | `#15151c` | 2px outlines |
| `--line-soft` | `#dcd8cc` | Dividers, the dot grid |
| `--stone` | `#e6e3da` | Neutral fill: inline code, lint notices |
| `--on-candy` | `#15151c` | Text on type colours, dark in both themes |
| `--bar` / `--on-bar` | `#15151c` / `#f2f0ea` | Top bar background and text |
| `--cobalt` | `#3a5cff` | Main colour: selection, current item, focus ring, the strip on the active tab |
| `--cobalt-text` | `#2d4de6` | Cobalt text on paper |
| `--cobalt-tint` | `#e6ebff` | Table headers, selected rows, code links |
| `--on-cobalt` | `#ffffff` | Text on cobalt (dark in the dark theme) |
| `--tomato` | `#ff5a3c` | Main action buttons; the question type |
| `--periwinkle` `--sky` `--lilac` `--sun` `--mint` `--pebble` | see [[design#Palette]] | Type colours |
| `--error` | `#d6293e` | Lint errors |
| `--highlight` | `#fff0a8` | `==highlight==` and search hits |
| `--shadow-sm` / `--shadow` / `--shadow-lg` | 2 / 4 / 6px offset | Hard shadows |
| `--shadow-accent` | 4px offset | Cobalt hard shadow, used on link previews |
| `--dots` / `--grid-dots` | Radial gradients | Halftone shadow and background dot grid |
| `--font-text` | Space Grotesk, with PingFang SC and Noto Sans SC for Chinese | Body font |
| `--font-mono` | Space Mono | Code and metadata |
| `--radius` | `8px` | Corner radius of panels and tabs |
| `--topbar-h` | `60px` | Top bar height |

The design decisions behind these variables are in [[design]].

## Plugins

`clio.config.ts` sits in the vault root and default-exports a configuration object (`clio.config.js` and `clio.config.mjs` work too). Bun runs TypeScript directly; there is no compile step. Plugins render custom fenced blocks: the engine leaves code blocks, math, Mermaid and charts as placeholders, and at build time Bun offers each placeholder to the plugins in the order of `plugins`. The plugin returns HTML.

A plugin claims a block when both conditions hold: it has no `langs`, or `langs` includes the block's language; and it has no `kinds`, or `kinds` includes the block's kind. If the claiming plugin returns `null` or `undefined`, the block goes on to the next plugin. If no plugin handles it, the built-in renderer does.

```ts title="clio.config.ts types"
export interface ClioConfig {
  plugins?: ClioPlugin[];
}

export interface ClioPlugin {
  /** Plugin name, printed in the build log */
  name: string;
  /** Code block languages this plugin handles, e.g. ["abc"]; omit to match any language */
  langs?: string[];
  /** Placeholder kinds it handles: code, math, mermaid, chart; omit for all */
  kinds?: Array<"code" | "math" | "mermaid" | "chart">;
  /** Return HTML, or null or undefined to pass the block on to the next plugin or the built-in renderer */
  render(block: PluginBlock, ctx: PluginContext): string | null | undefined | Promise<string | null | undefined>;
}

export interface PluginBlock {
  kind: "code" | "math" | "mermaid" | "chart";
  /** Language of the code block, e.g. "abc" */
  lang: string;
  /** title="…" from the info string */
  title: string | null;
  /** Lines to highlight (1-based), from {2,4-6} */
  highlight: number[];
  /** Remaining key=value pairs from the info string */
  attrs: Record<string, unknown>;
  /** Whether a formula is display math ($$…$$) */
  display: boolean;
  /** The block's source text */
  text: string;
  /** HTML used when no plugin handles the block */
  fallback: string;
  /** Line number in the source file */
  line: number;
}

export interface PluginContext {
  /** Language of the page being built */
  lang: string;
  /** The note being built */
  page: { id: string; title: string; path: string };
  /** Escape HTML special characters */
  escape(s: string): string;
  /** Highlight code with the built-in Shiki setup; returns HTML */
  highlight(code: string, lang: string): Promise<string>;
}
```

An example that renders ```` ```csv ```` blocks as tables:

```ts title="clio.config.ts"
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default {
  plugins: [
    {
      name: "csv-table",
      langs: ["csv"],
      render(block) {
        const [head, ...rows] = block.text.trim().split("\n").map((l) => l.split(","));
        const cells = (r: string[], tag: string) => r.map((c) => `<${tag}>${esc(c.trim())}</${tag}>`).join("");
        return `<table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${cells(r, "td")}</tr>`)
          .join("")}</tbody></table>`;
      },
    },
  ],
};
```

Plugins run at build time and their output is written into the static HTML, so no plugin code ships to the browser. The built-in Shiki highlighting, KaTeX math and chart rendering take the same path; user plugins come before them. Built-in results are cached by content (see [[cli#clio build]]); plugin results are not, so plugins run on every build.
