---
title: Command line
summary: Every clio command — synopsis, flags, sample output, exit codes — and the shape of the --json output.
tags: [cli, reference]
rel:
  part-of: index
  see-also: [getting-started, agents]
updated: 2026-10-13
translation-of-hash: "93cf11681258"
---
# Command line

`clio` is a Bun program, and everything goes through it: creating a project, writing notes, ingesting sources, checking, building and previewing the site, and giving agents JSON and MCP access. This page lists every command, grouped by purpose. For a first walk-through see [[getting-started]]; for agent workflows see [[agents]].

## Install

You need Bun 1.2 or later.

```bash
bun add -g github:nivalume/Clio
clio --version
```

Projects created by `clio new site` depend on `"clio": "github:nivalume/Clio"` in `package.json`, so `bunx clio …` also works inside a project. An npm release is on the [[roadmap]].

## Usage

```text
clio <command> [arguments] [--dir <vault>] [--json] [--lang <lang>]
```

`clio` searches upward from the current directory (or from `--dir`) for `clio.toml`; the directory that holds it is the vault root. If there is none, the starting directory is used as the root with default settings.

### Global flags

| Flag | Short | Effect |
|---|---|---|
| `--dir <path>` | | Vault directory; defaults to the current directory |
| `--json` | `-j` | Print JSON instead of human-readable text; shapes are in [[#JSON output]] |
| `--lang <lang>` | | Answer with this language's versions (titles, summaries, links); defaults to the first entry of `locales` |
| `--help` | `-h` | List the commands |
| `--version` | `-v` | Print the version |

Flags can be written as `--limit 5` or `--limit=5`. Everything after `--` is taken as positional arguments.

### Environment variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disables colour; output that is not a terminal is never coloured |
| `CLIO_TODAY` | Use this date (`YYYY-MM-DD`) instead of today for the `stale` check, which makes results reproducible |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | `check` found errors (or warnings, with `--strict`); `resolve` found no match; bad arguments, unknown command, or no such note |

Errors go to stderr and normal output to stdout, so pipelines such as `clio search parser --json | jq` are safe.

## Commands at a glance

| Command | Does |
|---|---|
| [[#clio new site]] | Create a project: config, `AGENTS.md`, home page and log, folders, templates, theme, deploy files, Agent Skill |
| [[#clio init]] | Set up a vault in the current folder; `--adopt` takes over an existing Obsidian vault |
| [[#clio new]] | Create a note from a template |
| [[#clio ingest]] | Store a raw source and create a draft source note |
| [[#clio log]] | Append an entry to `log.md` |
| [[#clio build]] | Build the static site |
| [[#clio dev]] | Build, serve, rebuild on file changes and reload the browser |
| [[#clio serve]] | Serve the last build only |
| [[#clio check]] | Lint notes and links; exit code 1 on errors |
| [[#clio show]] | A note's metadata, sections and relations |
| [[#clio backlinks]] | What points to a note |
| [[#clio search]] | BM25 full-text search |
| [[#clio context]] | A note and its neighbours as Markdown for a language model |
| [[#clio resolve]] | Which note an id, alias or title points to |
| [[#clio stats]] | Counts by type, clusters, lint totals |
| [[#clio mv]] | Rename a note and rewrite every link to it |
| [[#clio translate-status]] | Missing and stale translations |
| [[#clio mcp]] | Run an MCP server on stdio |

## Projects

### clio new site

```text
clio new site <dir> [--starter llm-wiki|docs|blank] [--locales zh,en] [--title T]
```

Creates a project directory, much like `hugo new site`. It writes `clio.toml`, `AGENTS.md` (plus a `CLAUDE.md` that contains only `@AGENTS.md`), `index.md`, `log.md`, `raw/`, one folder per note type under `notes/`, `templates/`, `theme/`, `package.json`, `vercel.json`, a GitHub Pages workflow and the Agent Skill. The layout is described in [[vault-layout]].

| Flag | Default | Effect |
|---|---|---|
| `--starter` | `llm-wiki` | `llm-wiki`: a personal knowledge base organised the Karpathy way; `docs`: a documentation site with `guides/ reference/ concepts/`; `blank`: config and home page only |
| `--locales` | `zh` | Languages; the first is the default |
| `--title` | directory name | Site title, written to `clio.toml` |

```text
$ clio new site my-kb --locales en,zh --title "My knowledge base"
created my-kb/ (starter: llm-wiki)
  clio.toml  AGENTS.md  CLAUDE.md  index.md  log.md
  raw/  notes/{sources,concepts,entities,topics,questions}/  journal/
  templates/ (7)  theme/theme.css
  package.json  vercel.json  .github/workflows/pages.yml
  agent skill: skills/clio/SKILL.md
next: cd my-kb && bun install && clio dev
```

If the target directory exists and is not empty, the command stops with an error and overwrites nothing.

### clio init

```text
clio init [--adopt]
```

Sets up a vault in the current directory (or `--dir`): writes `clio.toml`, `AGENTS.md` and the Agent Skill, leaving existing files alone.

`--adopt` is for an existing Obsidian vault. It moves no files. It reads the top-level folders, writes a folder-to-type mapping into `[folders]` in `clio.toml` (for you to confirm or edit) and installs the skill. `.obsidian/` and `.trash/` are ignored by default, so the vault still opens in Obsidian.

```text
$ clio init --adopt
found 1,284 notes in 9 folders
wrote clio.toml with [folders]:
  "Papers/" = "source"
  "People/" = "entity"
  "MOCs/"   = "topic"
  (6 folders left as type note; edit clio.toml to map them)
installed agent skill: skills/clio/SKILL.md
run: clio check
```

### clio new

```text
clio new <type> <title> [--id ID] [--tags a,b] [--lang en]
```

Creates a note from `templates/<type>.md` in the folder mapped to that type (see [[config#folders]]). Templates can use `{{title}}`, `{{id}}`, `{{date}}`, `{{lang}}` and `{{type}}`.

| Flag | Effect |
|---|---|
| `--id` | The note's id, which is also its file name; derived from the title by default |
| `--tags` | Comma-separated tags for the frontmatter |
| `--lang` | Create the `<id>.<lang>.md` translation of an existing note, or set the language of a new one |

```text
$ clio new concept "Pratt parser" --id pratt-parser --tags parser,compilers
created notes/concepts/pratt-parser.md
```

The command stops with an error if the id is taken.

## Sources and log

### clio ingest

```text
clio ingest <file|url> [--title T]
```

Adds a raw source to the vault: copies it into `raw/` (URLs are downloaded as-is, not converted), records its sha256, creates a `status: draft` source note in `notes/sources/` (with `raw:` and `sha256:` in the frontmatter) and appends an `ingest` entry to `log.md`. From then on `clio check` verifies that the raw file has not changed; see [[lint-codes#raw-modified]].

```text
$ clio ingest ~/Downloads/attention.pdf --title "Attention Is All You Need"
raw/attention-is-all-you-need.pdf  sha256 3f2a9c…e81b
created notes/sources/attention-is-all-you-need.md (draft)
log.md  ## [2026-10-13] ingest | Attention Is All You Need
```

### clio log

```text
clio log <op> <title>
```

Appends a heading `## [YYYY-MM-DD] op | title` to the end of `log.md`. The log is append-only; old entries are never edited. Common values of `op` are `ingest`, `query`, `lint` and `edit`.

```text
$ clio log query "Pratt parsing vs recursive descent"
log.md  ## [2026-10-13] query | Pratt parsing vs recursive descent
```

## Build and preview

### clio build

```text
clio build [--out DIR] [--base /path/]
```

Builds the static site into `.clio/site`: one HTML page per note per language, the React app, a Pagefind search index, `llms.txt` and a `.md` mirror of every note. The build is described in [[architecture]]; deployment in [[deploy]].

| Flag | Default | Effect |
|---|---|---|
| `--out` | `.clio/site` | Output directory |
| `--base` | `base` in `clio.toml` | URL path the site is served from, e.g. `/kb/` for a GitHub Pages project site |

```text
$ clio build --base /kb/
206 notes · 2 languages · 412 pages
search index: 412 pages, 2 languages
built .clio/site in 3.8 s
```

### clio dev

```text
clio dev [--port 4321]
```

Builds once, starts a local server and watches the vault. On a change it re-parses only the changed notes, rebuilds the site and reloads the browser.

```text
$ clio dev
built 206 notes in 3.6 s
serving http://localhost:4321  (watching for changes)
changed notes/concepts/pratt-parser.md → rebuilt in 180 ms
```

### clio serve

```text
clio serve [--port 4321]
```

Serves the output of the last `clio build` without building or watching. Use it to look at exactly what you are about to deploy.

```text
$ clio serve --port 8080
serving .clio/site at http://localhost:8080
```

## Checking and querying

These commands are read-only and all accept `--json`.

### clio check

```text
clio check [--strict] [--all] [--level error|warning|info] [--json]
```

Lints the whole vault: frontmatter, links, anchors, relations, directives, queries, translations and raw sources. Each code, its meaning and its fix are listed in [[lint-codes]]. `clio lint` is the same command.

| Flag | Effect |
|---|---|
| `--strict` | Exit with code 1 on warnings too |
| `--all` | Also show notices |
| `--level` | Lowest level to show, `warning` by default; `--all` equals `--level info` |

```text
$ clio check
notes/concepts/pratt-parser.md
  14   warning wanted                link to missing note `tokenizer`
  21   warning missing-anchor        no heading `benchmarks` in `parser-generators`

206 notes · 211 files · 1834 links · 1 wanted · 0 errors · 2 warnings · 9 notices
```

Each line shows the line number, level, code and message. The summary line always counts all three levels, whatever level is shown.

Exit code: 1 on errors, or on warnings with `--strict`; otherwise 0.

### clio show

```text
clio show <id> [--lang en] [--json]
```

A note's title, id, type, path, summary, tags and sections, its typed relations in both directions, and its plain backlinks. The argument may be an id, alias or title, resolved the same way as a `[[ ]]` link.

```text
$ clio show pratt-parser --lang en
Pratt parser  pratt-parser · concept · notes/concepts/pratt-parser.en.md
Parses expressions by operator precedence with one recursive function.
tags: #parser #compilers

Sections
- Algorithm
- Associativity

→ depends on
  Tokenizer tokenizer
← used by
  Expression engine expr-engine

← linked from (2)
  Recursive descent recursive-descent
  Parser comparison parser-comparison
```

Exits with code 1 if no note matches.

### clio backlinks

```text
clio backlinks <id> [--json]
```

Only what points to the note: typed relations grouped by their inverse label, then plain links with the sentence that contains each one.

```text
$ clio backlinks pratt-parser --lang en
used by
  Expression engine expr-engine
linked from (2)
  Recursive descent recursive-descent
    A Pratt parser ([[pratt-parser]]) is a variant of it.
  Parser comparison parser-comparison
    Of the hand-written options, [[pratt-parser]] is the shortest.
```

### clio search

```text
clio search <query> [--limit N] [--json]
```

BM25 full-text search over titles, aliases, tags, section headings and body text, weighted 4, 2.5 (aliases and tags), 1.5 and 1. Chinese is split into single characters and adjacent pairs, other text into words, so mixed Chinese and English queries work. Returns 10 hits by default.

```text
$ clio search precedence parser --limit 3
Pratt parser  pratt-parser · concept · notes/concepts/pratt-parser.md
  A minimal implementation of precedence climbing; see recursive descent.
Operator precedence table  operator-table · concept · notes/concepts/operator-table.md
  One row per precedence level, lowest first.
Recursive descent  recursive-descent · concept · notes/concepts/recursive-descent.md
  One function per grammar rule.
```

With no hits it prints `no matches` and still exits with 0.

### clio context

```text
clio context <id> [--hops N] [--json]
```

Collects a note's source file and the notes around it into one block of Markdown, ready to put into a language model's context. `--hops` defaults to 1 and is capped at 3: 1 means directly connected notes, 2 adds their neighbours.

```text
$ clio context pratt-parser --hops 2
# Pratt parser (pratt-parser, concept)

path: notes/concepts/pratt-parser.md

---
title: Pratt parser
… (the full source of the note)

## Direct relations

- → depends-on **Tokenizer** (`tokenizer`): Splits source text into tokens.
- ← link **Recursive descent** (`recursive-descent`): One function per grammar rule.

## Further notes (up to 2 hops)

- **Parser generators** (`parser-generators`, concept, hop 2): Build a parser from a grammar.

## Wanted (linked but not written yet)

- operator-precedence-climbing
```

### clio resolve

```text
clio resolve <text> [--json]
```

Which note an id, alias or title points to. Lookup order is id → alias → title → path, case-insensitive, with spaces and `_` treated as `-`. Use it to check a target before writing a link.

```text
$ clio resolve "precedence climbing"
pratt-parser  notes/concepts/pratt-parser.md
```

With no match it prints `no match` and exits with 1.

### clio stats

```text
clio stats [--json]
```

An overview of the vault: counts of notes, files, links, wanted notes, words and tags; counts per type; and the automatic clusters with their sizes.

```text
$ clio stats --lang en
My knowledge base
206 notes · 211 files · 1834 links · 1 wanted · 58210 words · 47 tags

Types
  Topic      12
  Concept    81
  Entity     34
  Source     52
  Question   27

Clusters
  #parser                  31
  #llm                     28
  Transformer              17
```

How clusters are named is explained in [[knowledge-graph#Louvain communities]].

## Maintenance

### clio mv

```text
clio mv <old-id> <new-id>
```

Renames a note: changes the file name (of every language version) and rewrites every link to it across the vault, including `[[old-id|text]]`, `[[rel::old-id]]`, `![[old-id#section]]` and `rel` entries in frontmatter. Moving a file to another folder does not need this command: links resolve by id, not by path.

```text
$ clio mv pratt pratt-parser
renamed notes/concepts/pratt.md → notes/concepts/pratt-parser.md
renamed notes/concepts/pratt.en.md → notes/concepts/pratt-parser.en.md
rewrote 7 links in 5 files
```

If `<new-id>` is taken, the command stops with an error and changes nothing.

### clio translate-status

```text
clio translate-status
```

Lists missing translations and stale ones — translations whose `translation-of-hash` no longer matches the current hash of the source — with the hash to pin for each. The workflow is in [[multilingual]].

```text
$ clio translate-status
missing (2)
  notes/concepts/tokenizer.md          en
  notes/topics/compilers.md            en
stale (1)
  notes/concepts/pratt-parser.en.md    translation-of-hash: "9c1e0b7a4d2f"
```

## Agent interface

### clio mcp

```text
clio mcp [--dir <vault>]
```

Runs an MCP (Model Context Protocol) server on stdio that exposes `search`, `show`, `backlinks`, `context` and `check` as tools, with the same arguments and JSON results as the commands of the same name. Logs go to stderr.

Register it with Claude Code:

```bash
claude mcp add clio -- clio mcp --dir ~/my-kb
```

Generic configuration for other clients:

```json
{ "mcpServers": { "clio": { "command": "clio", "args": ["mcp", "--dir", "/home/me/my-kb"] } } }
```

## JSON output

With `--json`, a command writes one JSON value to stdout (two-space indent), with no colour and no extra text. Field names are stable; agents should rely on them rather than on the text format.

**check** prints an object with `summary` and `diags`. `summary` has `notes` (all language versions of a note count as one), `files`, `edges` (links), `wanted`, `clusters`, `errors`, `warnings` and `infos`. `diags` is an array; each entry has `path` (relative to the vault root), `level` (`error`, `warning` or `info`), `line` (1-based), `code` and `message`. Entries are sorted by path and filtered by `--level`.

```json
{
  "summary": { "notes": 206, "files": 211, "edges": 1834, "wanted": 1, "clusters": 9, "errors": 0, "warnings": 1, "infos": 9 },
  "diags": [
    { "path": "notes/concepts/pratt-parser.md", "level": "warning", "line": 14, "code": "wanted", "message": "link to missing note `tokenizer`" }
  ]
}
```

**search** prints an array, best match first. Each hit has `id`, `title`, `type`, `path`, `url`, `score` (three decimals) and `snippet` (the first body line that contains a query term, cut to about 120 characters around the match; the summary if no line matches).

**show** prints an object describing the note in the requested language: `id`, `key` (the normalised id), `lang` (the requested language), `noteLang` (the language of the version actually used), `fallback` (true when there is no version in that language and the default one was used), `path`, `title`, `type`, `summary`, `tags`, `aliases`, `status`, `created`, `updated`, `reviewed`, `words` and `url`. `outline` lists headings of levels two to four (`depth`, `text`, `slug`). `relations` holds typed relations grouped by label, each group with `label`, `direction` (`out` or `in`) and `items`. `backlinks` lists the sources of plain links, each with the `context` sentence. `local` is the local graph (`nodes` and `edges`). `translations` gives `lang`, `url`, `exists` and `title` for every language. `hash` is the content hash of this file (the value a translation pins in `translation-of-hash`), `sourceHash` the hash of the default-language version and `translationOfHash` the value this file declares. Finally `rank` (PageRank), `cluster` (cluster number) and `data` (all frontmatter fields). The rendered HTML is left out.

**context** prints an object. `note` is the note itself (`id`, `title`, `type`, `path`, `summary`, `tags`, `aliases`, `text`, `headings`, plus the full source file as `source`). `relations` lists the direct edges, each with the other note's `id`, the edge `kind` (a relation name, `link` or `embed`), `direction` and the `context` sentence. `neighbours` lists the notes within `--hops`, each with `id`, `title`, `type`, `summary`, `path`, `tags` and `hop` (distance). `wanted` lists the names this note links to that have no note yet.

The others: `backlinks` prints `{ id, relations, backlinks }`, where `relations` holds only the incoming direction; `resolve` prints `{ id, path }`, or `null` when nothing matches; `stats` prints `{ stats, types, clusters, lint }`.
