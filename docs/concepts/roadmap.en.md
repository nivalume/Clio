---
title: Roadmap
summary: What v1 already has, what is planned next, and why each planned item is not done yet.
tags: [roadmap]
rel:
  part-of: index
  see-also: [architecture]
updated: 2026-10-13
translation-of-hash: "5f0fb202854a"
---
# Roadmap

This page lists what Clio v1 already does and what comes later. Planned items have no dates; the order is roughly their priority. To take part or suggest something, open an issue in the [GitHub repository](https://github.com/nivalume/Clio).

## In v1

- [x] Clio Markdown: CommonMark, GFM, wikilinks, typed relations, embeds, block ids, tags, callouts, directives, code highlighting, math, Mermaid, charts and query blocks; see [[syntax-cheatsheet]]
- [x] A Rust engine compiled to about 1.5 MB of WebAssembly and loaded by Bun, so users need no Rust
- [x] Native and WebAssembly builds give byte-identical output, enforced by a test
- [x] Link resolution (id → alias → title → path), inverse labels, ghost nodes
- [x] PageRank, Louvain clusters and automatic cluster names; see [[knowledge-graph]]
- [x] 19 lint codes; see [[lint-codes]]
- [x] BM25 search on the command line (Chinese and English) and Pagefind search on the site
- [x] Chinese and English: translation files, per-language URLs, staleness detection with `translation-of-hash`
- [x] Command line: `new site`, `init --adopt`, `new`, `ingest`, `build`, `dev`, `serve`, `check`, `show`, `backlinks`, `search`, `context`, `resolve`, `stats`, `mv`, `log`, `translate-status`, `mcp`; see [[cli]]
- [x] `--json` output on the read commands, and an MCP server
- [x] An Agent Skill following Karpathy's "LLM Wiki" pattern; see [[agents]]
- [x] A static site: search-first home page, faceted explore view, note pages, global graph, tags, health page, light and dark themes
- [x] `theme.css` variables and `clio.config.ts` render plugins
- [x] Configuration files for deploying to GitHub Pages and Vercel; see [[deploy]]

## Planned

### Release and installation

- [ ] **Publish to npm.** Today Clio installs from GitHub (`bun add -g github:nivalume/Clio#v0.1.0`). The npm name `clio` belongs to an unrelated package, so the release will use a scoped name (such as `@nivalume/clio`); after that Clio installs and upgrades by ordinary version numbers.
- [ ] **Prebuilt native binaries.** The WebAssembly build is fast enough; the native build is currently used only for tests and benchmarks. For very large vaults, prebuilt native engines per platform would shorten builds further; see [[performance]].

### Ingest

- [ ] **Convert web pages to Markdown in `clio ingest`.** Today a URL is downloaded and stored as-is, and the agent has to read the HTML itself. The plan is to also write a clean Markdown version, while the original stays in `raw/` and the hash still covers the original.

### Syntax

- [ ] **Inline directives.** Directives exist only as blocks (`:::name`) today. Inline forms are planned, such as `:kbd[Ctrl+K]` and `:badge[beta]`.
- [ ] **A raw HTML allowlist.** Raw HTML is always dropped today, because notes may come from web pages. The plan is to let `clio.toml` list a small set of safe tags (such as `<kbd>`, `<sub>`, `<sup>`) while everything else is still dropped.

### Graph

- [ ] **Leiden clustering.** Louvain can produce communities that are internally disconnected; the Leiden algorithm adds a refinement step that guarantees connected communities and usually gives more stable results. Determinism must be kept, so it needs an implementation without random numbers.
- [ ] **A WebGL graph beyond 50,000 nodes.** The graph view uses a d3 force-directed layout and draws nodes and edges one by one in the browser. Beyond roughly 50,000 nodes the drawing itself becomes the bottleneck, and WebGL is needed.

### Site

- [ ] **Hydration.** Today the static HTML and the React app are separate: the static page shows first, then the app takes over rendering. The plan is for the app to hydrate the static HTML directly, reducing flicker and duplicate work on first load.

### Editing

- [ ] **Editor integration.** `[[` completion, go-to-link, hover previews and live lint results in editors such as VS Code, built on the same engine (for example through the Language Server Protocol).

## Not planned

- **A server side.** The site stays fully static; see [[architecture#Why a static site]].
- **A database.** The Markdown files are the data and version control is the history.
- **Accounts and permissions.** Access control is left to the hosting platform and the repository.
