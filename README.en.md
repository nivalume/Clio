# Clio

[中文](README.md) · Handbook: <https://clio-one.vercel.app/en>

A knowledge base for the agent era. You write notes in Markdown with extensions; a Rust engine (compiled to
WebAssembly, run by Bun) parses them, resolves links, builds a knowledge graph and writes a static website. People and
AI agents maintain the same vault through a command line and an agent skill.

- **Typed links.** `[[id]]` is Obsidian-compatible and resolves by stable id, alias or title, so renaming or moving files
  does not break links. `[[depends-on::id]]` states a relation; the target shows the inverse (used by, has part, cited
  by, …) automatically. Links to missing notes become "wanted" nodes.
- **Rich content.** Callouts, tabs, cards, steps, Shiki highlighting, KaTeX, Mermaid, charts, and query blocks
  (Dataview-like) evaluated at build time.
- **Built for scale.** The engine parses each note once, then resolves links, computes PageRank and Louvain clusters,
  lints and builds a BM25 index over the whole vault. The site is plain static files with data loaded on demand and
  Pagefind search.
- **Made for agents.** Every read command has `--json`; `clio context` packs a note and its neighbours into Markdown;
  `clio mcp` is an MCP server; the bundled skill follows Karpathy's LLM Wiki pattern (ingest, query, lint, translate).
- **Bilingual.** `x.md` and `x.en.md` are one note in two languages; the UI switches language and `translation-of-hash`
  tracks stale translations.

## Start

You need [Bun](https://bun.sh) 1.2 or later. No Rust: the engine ships as a `.wasm` file.

```bash
bun add -g github:nivalume/Clio#v0.1.0
clio new site my-kb --locales en      # starters: llm-wiki (default), docs, blank
cd my-kb && bun install
bun run dev                           # http://localhost:4321
```

A new project comes with `AGENTS.md`, the agent skill (`skills/clio`, linked into `.claude/skills` and
`.agents/skills`), `vercel.json` and a GitHub Pages workflow.

## Commands

| Command | Does |
|---|---|
| `clio new site <dir>` | create a project (like `hugo new site`) |
| `clio init [--adopt]` | set up a vault in an existing folder; `--adopt` for an Obsidian vault |
| `clio new <type> <title>` | a note from its template |
| `clio ingest <file\|url>` | add a source: copy to `raw/`, record sha256, draft a source note, log it |
| `clio check` | links, anchors, frontmatter, raw sources, translations |
| `clio search` · `show` · `backlinks` · `context` · `resolve` · `stats` | read the vault |
| `clio mv <old> <new>` | change an id and rewrite every link to it |
| `clio log <op> <title>` | append an entry to `log.md` |
| `clio translate-status [--pin id]` | missing and stale translations |
| `clio build` · `dev` · `serve` | build and preview the static site |
| `clio mcp` | MCP server on stdio |

Details: the [CLI reference](https://clio-one.vercel.app/en/n/cli).

## Repository

```text
crates/clio-core     Rust engine: syntax, rendering, link resolution, graph algorithms, lint, queries, search
crates/clio-wasm     the engine for wasm32 (packages/clio/engine/clio.wasm is committed)
crates/clio-native   native binary for tests and benchmarks
packages/clio        the CLI (Bun + TypeScript) and the site builder
packages/web         the web app (React + Vite), built into packages/clio/web (committed)
skills/clio          the agent skill
starters/            starters for clio new site
docs/                Clio's own handbook, itself a Clio vault
```

Development:

```bash
bun install
cargo test --workspace
bun test
bun run typecheck
bun run build:wasm      # after changing crates/
bun run build:web       # after changing packages/web/
bun run check:fresh     # the committed .wasm and app match their sources
bun run build:docs && bun packages/clio/bin/clio.ts serve --dir docs
```

## License

MIT
