---
title: Command line
summary: Every clio command — synopsis, flags, sample output, exit codes — and the shape of the --json output.
tags: [cli, reference]
rel:
  part-of: index
  see-also: [getting-started, agents]
updated: 2026-10-13
translation-of-hash: "6dd5d7371f79"
---
# Command line

`clio` is a Bun program, and everything goes through it: creating a project, writing notes, ingesting sources, checking, building and previewing the site, and giving agents JSON and MCP access. This page lists every command, grouped by purpose. For a first walk-through see [[getting-started]]; for agent workflows see [[agents]].

## Install

You need Bun 1.2 or later.

```bash
bun add -g github:nivalume/Clio#v0.1.0
clio --version
```

Projects created by `clio new site` depend on `"clio": "github:nivalume/Clio#v0.1.0"` in `package.json` and define four scripts: `dev`, `build`, `check` and `serve`. After `bun install` in a project, both `bun run build` and `bunx clio build` use the Clio installed in that project. Don't use `bunx clio` in a folder where Clio is not installed: the npm registry has an unrelated package named `clio`, and `bunx` would download and run it. An npm release is on the [[roadmap]].

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
| `1` | `check` found errors (or warnings, with `--strict`); `build --strict` and the vault has errors; `resolve` found no match; bad arguments, unknown command, or no such note |

Errors go to stderr and normal output to stdout, so pipelines such as `clio search parser --json | jq` are safe.

## Commands at a glance

| Command | Does |
|---|---|
| [[#clio new site]] | Create a project: config, `AGENTS.md`, home page and log, folders, templates, theme, deploy files, Agent Skill |
| [[#clio init]] | Write the config, `AGENTS.md` and the Agent Skill in the current folder; `--adopt` takes over an existing Obsidian vault |
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
| [[#clio translate-status]] | Missing, unpinned and stale translations; `--pin` records the source's hash |
| [[#clio mcp]] | Run an MCP server on stdio |

## Projects

### clio new site

```text
clio new site <dir> [--starter llm-wiki|docs|blank] [--locales zh,en] [--title T]
```

Creates a project directory, much like `hugo new site`. Every starter writes `clio.toml`, `AGENTS.md` (plus a `CLAUDE.md` that contains only `@AGENTS.md`), `README.md`, `.gitignore`, `index.md`, `log.md`, `templates/`, `theme/theme.css`, `package.json`, `vercel.json` and `.github/workflows/pages.yml`. The layout is described in [[vault-layout]].

| Flag | Default | Effect |
|---|---|---|
| `--starter` | `llm-wiki` | The starter; see the table below |
| `--locales` | `zh` | Languages; the first is the default |
| `--title` | directory name | Site title, written to `clio.toml` |

| Starter | Contents |
|---|---|
| `llm-wiki` | A knowledge base organised the Karpathy way: `raw/`, five type folders under `notes/`, `journal/`, 7 templates and a worked example |
| `docs` | A documentation site: one example page each in `guides/`, `reference/` and `concepts/`; templates `guide`, `reference`, `concept` and `note` |
| `blank` | Config, home page and a `note` template only |

The `llm-wiki` example goes through one ingest and one question: a raw source `raw/one-idea-per-card.md` and its source note, the concepts `atomic-note` and `zettelkasten`, the entity `niklas-luhmann`, the topic `note-taking`, the question `why-one-idea-per-note`, and four entries in `log.md` (`init`, `ingest`, `query`, `lint`). The topic note has a deliberate link to the missing note `spaced-repetition`, so `clio check` on a new project reports one `wanted` warning.

For each language in `--locales` after the first, if the starter has text in it (`zh` or `en`), the command writes translations `x.<lang>.md` with `translation-of-hash` already set.

The Agent Skill is copied to `skills/clio/` and linked as `.claude/skills/clio` and `.agents/skills/clio`, where Claude Code, Codex and other tools look for skills. Where symlinks cannot be created, the skill is copied instead.

`package.json` depends on `"clio": "github:nivalume/Clio#v0.1.0"`; its scripts `dev`, `build`, `check` and `serve` run the `clio` command of the same name. The contents of `vercel.json` and the workflow are in [[deploy]].

```text
$ clio new site my-kb --locales en,zh --title "My knowledge base"
created my-kb/ (starter: llm-wiki)
  .gitignore  AGENTS.md  CLAUDE.md  README.md  clio.toml  index.md  index.zh.md  log.md  package.json  vercel.json
  journal/  notes/  raw/  skills/  templates/  theme/  (templates: 7)
  agent skill: skills/clio/SKILL.md, .claude/skills/clio, .agents/skills/clio
next: cd my-kb && bun install && bun run dev
```

If the target directory exists and is not empty, the command stops with an error and overwrites nothing.

### clio init

```text
clio init [--adopt] [--locales zh,en] [--title T] [--dir DIR]
```

Sets up a vault in the current directory (or `--dir`): writes `clio.toml`, `AGENTS.md`, `CLAUDE.md` and the Agent Skill (in the same places as `clio new site`: `skills/clio/`, linked as `.claude/skills/clio` and `.agents/skills/clio`). It never overwrites an existing file. It writes no home page, templates or deployment files.

| Flag | Default | Effect |
|---|---|---|
| `--adopt` | | Take over an existing Obsidian vault; see below |
| `--locales` | `zh` | Languages written to `clio.toml`; the first also decides whether `AGENTS.md` is in Chinese or English |
| `--title` | directory name | Site title |

`--adopt` is for an existing Obsidian vault. It moves no files. It counts the notes in each top-level folder, guesses a type from each folder name (for example `Papers` → `source`, `People` → `entity`, `MOCs` → `topic`, `Daily` → `journal`) and writes the result into `[folders]` in `clio.toml`. Folders it cannot place are written as commented lines; remove the `#` and set a type if you want one. `.obsidian/` and `.trash/` are ignored by default, so the vault still opens in Obsidian.

```text
$ clio init --adopt
found 22 notes in 7 folders
wrote clio.toml with [folders]:
  "Daily/" = "journal"
  "People/" = "entity"
  "Papers/" = "source"
  "MOCs/" = "topic"
  (3 folders left as type note; edit clio.toml to map them)
installed agent skill: skills/clio/SKILL.md, .claude/skills/clio, .agents/skills/clio
wrote clio.toml, AGENTS.md, CLAUDE.md
run: clio check
```

```toml title="clio.toml (excerpt)"
# Folder → note type for notes without `type:` in their frontmatter.
[folders]
"Daily/"  = "journal"
"People/" = "entity"
"Papers/" = "source"
"MOCs/"   = "topic"
# "Inbox/" = "note"
# "Archive/" = "note"
# "Projects/" = "note"
```

### clio new

```text
clio new <type> "<title>" [--id ID] [--tags a,b] [--lang xx]
```

Creates a note in the folder mapped to that type in `[folders]` (see [[config#folders]]), or in `notes/` when no folder is mapped (the vault root if there is no `notes/` folder). The text comes from `templates/<type>.md`, or from a built-in template when that file doesn't exist (frontmatter with `title`, `type`, `summary`, `tags`, `status: seed`, `created` and `updated`). Templates can use `{{title}}`, `{{id}}`, `{{date}}`, `{{lang}}` and `{{type}}`.

| Flag | Effect |
|---|---|
| `--id` | The note's id, which is also its file name; derived from the title by default |
| `--tags` | Comma-separated tags for the frontmatter |
| `--lang` | With an existing id, create its translation `<id>.<lang>.md`; otherwise set the language of the new note |

An id derived from a title is lowercased, spaces and punctuation become `-`, and letters of any script are kept. A Chinese title therefore gives a Chinese id: `clio new concept "倒排索引"` creates `notes/concepts/倒排索引.md`. Pass `--id` for an English id.

```text
$ clio new concept "Pratt parser" --id pratt-parser --tags parser,compilers
created notes/concepts/pratt-parser.md
```

`--lang` with an existing id creates a copy of the source next to it, with the title from the command and the body left for you to translate. When the translation is done, record the hash with `--pin` from [[#clio translate-status]]:

```text
$ clio new concept "Tokenizer" --id tokenizer --lang en
created notes/concepts/tokenizer.en.md (translation of notes/concepts/tokenizer.md; pin it with clio translate-status --pin tokenizer when done)
```

The command stops with an error if the type is unknown, the id is taken or the file exists.

## Sources and log

### clio ingest

```text
clio ingest <file|url> [--title T] [--id ID]
```

Adds a raw source to the vault:

1. Copies it to `raw/<id><ext>`. A URL is downloaded as-is, not converted; the extension comes from the URL path, or from the response's content type if the path has none. If `raw/` already holds a different file with that name, `-2`, `-3`… is added to the name; an existing file is never overwritten.
2. Records its sha256.
3. Creates a `status: draft` source note in the folder mapped to the `source` type (`notes/sources/` by default), from `templates/source.md` if it exists and from a built-in template otherwise. The frontmatter gets `raw:` and `sha256:`, and `url:` for a URL.
4. Appends an `ingest` entry to `log.md`, listing the raw file and the new note.

| Flag | Effect |
|---|---|
| `--title` | Title of the source note; defaults to the file name with `-` and `_` turned into spaces |
| `--id` | Id of the source note, also the file name in `raw/`; derived from the title by default, as in [[#clio new]] |

If the id is taken, the command stops with an error and writes nothing. From then on `clio check` verifies that the raw file has not changed or disappeared; see [[lint-codes#raw-modified]].

```text
$ clio ingest ~/Downloads/attention.pdf --title "Attention Is All You Need"
raw/attention-is-all-you-need.pdf  sha256 3f2a9c…e81b
created notes/sources/attention-is-all-you-need.md (draft)
log.md  ## [2026-10-13] ingest | Attention Is All You Need
```

```text
$ clio ingest https://example.com/
raw/example-com.html  sha256 25ddf2…e484
created notes/sources/example-com.md (draft)
log.md  ## [2026-10-13] ingest | example.com
```

### clio log

```text
clio log <op> "<title>" [--message "<lines>"]
```

Appends a heading `## [YYYY-MM-DD] op | title` to the end of `log.md`. Each line of `--message` is written below the heading, usually a list of the notes changed. If `log.md` doesn't exist, it is created. The log is append-only; old entries are never edited. Common values of `op` are `ingest`, `query`, `lint` and `edit`.

```text
$ clio log query "Pratt parsing vs recursive descent" --message "- created: pratt-vs-recursive-descent
- updated: compilers"
log.md  ## [2026-10-13] query | Pratt parsing vs recursive descent
```

This writes to `log.md`:

```markdown
## [2026-10-13] query | Pratt parsing vs recursive descent
- created: pratt-vs-recursive-descent
- updated: compilers
```

## Build and preview

### clio build

```text
clio build [--out DIR] [--base /path/] [--no-search] [--no-cache] [--json] [--strict]
```

Builds the static site into `.clio/site`. The output has one HTML page and one `.md` source per note per language; the home, graph, explore, tags, health and wanted pages; one page per tag (`tags/<tag>.html`, including the parents of nested tags); `404.html`; `.nojekyll`; the React app; a Pagefind search index; `llms.txt`; and the images notes refer to, under `_assets/`. When `[site] url` is set in `clio.toml`, it also writes `sitemap.xml` and `robots.txt`. The build is described in [[architecture]]; the output folder and deployment in [[deploy]].

| Flag | Default | Effect |
|---|---|---|
| `--out` | `.clio/site` | Output directory |
| `--base` | `base` in `clio.toml` | URL path the site is served from, e.g. `/kb/` |
| `--no-search` | | Skip the search index; builds faster |
| `--no-cache` | | Neither read nor write the build cache |
| `--json` | | Print one JSON object; see [[#JSON output]] |
| `--strict` | | Exit with code 1 if the vault has errors; without it the site is built anyway and the exit code is 0 |

The output folder is deleted before each build, so `clio build` refuses to write into the vault itself, a folder above it, or any folder that contains a `clio.toml`.

Rendered code blocks, formulas and charts are cached by content in `node_modules/.cache/clio/render.json`, or in `.clio/cache/` when the project has no `node_modules`. Blocks that haven't changed are not rendered again. The graph layout is kept in the same folder (`layout.json`); the next build starts from the previous positions, so nodes stay where they were.

```text
$ clio build --dir docs
vault: 0.0 s
layout: 21 nodes in 2 ms (warm start)
pages (zh): 0.0 s
pages (en): 0.0 s
assets, app, llms.txt: 0.1 s
search index: 0.6 s
built 40 pages (20 notes) → docs/.clio/site in 0.8 s
  0 images · render cache 416 hit / 0 new · 0 errors, 10 warnings (clio check --dir docs)
```

The first lines time each phase: reading and checking the vault (`vault`), the graph layout (`layout`, with the number of nodes; `(warm start)` means it started from the previous layout), the pages of each language, the static files and `llms.txt`, and the search index. The `built` line gives the number of pages (notes times languages), the number of notes, the output folder and the total time. The last line gives the images copied, render cache hits and new entries, and the vault's errors and warnings; when there are errors or warnings, the parentheses give the command that shows them.

### clio dev

```text
clio dev [--port 4321] [--search]
```

Builds once, starts a local server and watches the vault. The output goes to `.clio/dev`, separate from the `.clio/site` of `clio build`. The search index is skipped unless you pass `--search`.

It watches notes, `clio.toml`, `clio.config.*`, `theme/` and images. When a note changes, only the changed notes are parsed again; when `clio.toml` or `clio.config.*` changes, the configuration is read again. Then the site is rebuilt and open pages reload.

```text
$ clio dev
vault: 0.0 s
layout: 11 nodes in 4 ms
pages (zh): 0.2 s
assets, app, llms.txt: 0.1 s
built 8 pages (8 notes) → .clio/dev in 0.2 s
  0 images · render cache 0 hit / 1 new · 0 errors, 3 warnings (clio check --dir .)
dev server at http://localhost:4321/ (watching .)
vault: 0.0 s
layout: 11 nodes in 1 ms (warm start)
pages (zh): 0.0 s
assets, app, llms.txt: 0.0 s
built 8 pages (8 notes) → .clio/dev in 0.1 s
  0 images · render cache 1 hit / 0 new · 0 errors, 3 warnings (clio check --dir .)
```

Each rebuild prints the same lines as `clio build`.

### clio serve

```text
clio serve [--port 4321] [--out DIR]
```

Serves the output of the last `clio build` (`.clio/site`, or the folder given with `--out`) without building or watching. Use it to look at exactly what you are about to deploy. URLs are handled as on a static host: `/a` is looked up as `a`, `a.html` and `a/index.html`, and `404.html` is returned if none exists. If nothing has been built, the command stops with an error.

```text
$ clio serve --port 8080
serving .clio/site at http://localhost:8080/
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

Renames a note: changes the file name (of every language version) and rewrites everything in the vault that points to it:

- `[[ ]]` links in every form: `[[old-id]]`, `[[old-id|text]]`, `[[rel::old-id]]`, `[[old-id#section]]`, `[[old-id^block-id]]`;
- embeds: `![[old-id]]`, `![[old-id#section]]`;
- `rel:` entries in frontmatter, and the note's own `id:`;
- relative Markdown links to the renamed files, such as `[text](old-id.md)`.

Fenced code blocks and inline code are left alone. Translations that matched their source before the move (`translation-of-hash` equal to the source's hash) get the new hash written after it, so rewriting links doesn't make them stale.

Moving a file to another folder does not need this command: links resolve by id, not by path.

```text
$ clio mv pratt pratt-parser
renamed notes/concepts/pratt.md → notes/concepts/pratt-parser.md
renamed notes/concepts/pratt.en.md → notes/concepts/pratt-parser.en.md
rewrote 8 links in 4 files
```

If `<new-id>` is taken, the command stops with an error and changes nothing.

### clio translate-status

```text
clio translate-status [--lang xx] [--json] [--pin id1,id2]
```

Lists the translations that need work, in three groups:

| Group | Meaning |
|---|---|
| `missing` | A language has no translation of the note yet; shows the source path and the language |
| `unpinned` | The translation has no `translation-of-hash` |
| `stale` | The translation's `translation-of-hash` differs from the source's current hash |

Each `unpinned` and `stale` line gives the hash to write. The last line counts the translations that already match their source. `--lang` limits the list to one language. The workflow is in [[multilingual]].

```text
$ clio translate-status
missing (2)
  notes/topics/compilers.md                en
  notes/concepts/tokenizer.md              en
stale (1)
  notes/concepts/pratt-parser.en.md        translation-of-hash: "95e9d39fdb50"
1 current · after updating a translation: clio translate-status --pin <id>
```

`--pin` writes the source's current hash into the translations of the listed notes: all languages by default, only one with `--lang`. Translations that already match are left alone.

```text
$ clio translate-status --pin pratt-parser
pinned notes/concepts/pratt-parser.en.md → 95e9d39fdb50
```

`--pin` only records that the translation now follows this version of the source; it doesn't look at the translation's content. Run it after you have updated the translation.

## Agent interface

### clio mcp

```text
clio mcp [--dir <vault>]
```

Runs an MCP (Model Context Protocol) server on stdio with five tools:

| Tool | Arguments | Result |
|---|---|---|
| `search` | `query`; optional `limit`, `lang` | Same as `clio search --json` |
| `show` | `id`; optional `lang` | Same as `clio show --json` |
| `backlinks` | `id`; optional `lang` | Same as `clio backlinks --json` |
| `context` | `id`; optional `hops`, `lang` | The same Markdown as `clio context` |
| `check` | optional `all`: true includes notices | Same as `clio check --json` |

Before each tool call the server re-reads the files that changed, so notes the agent edits between two calls are seen by the next one. Logs go to stderr.

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

**translate-status** prints an array with one entry per translation that needs work: `id`, `source` (the source path), `lang`, `status` (`missing`, `unpinned` or `stale`), `path` (the translation's path, `null` when missing), `hash` (the source's current hash) and `translationOfHash` (the value the translation declares, or `null`).

```json
[
  {
    "id": "pratt-parser",
    "source": "notes/concepts/pratt-parser.md",
    "lang": "en",
    "status": "stale",
    "path": "notes/concepts/pratt-parser.en.md",
    "hash": "95e9d39fdb50",
    "translationOfHash": "0c06ce7df7c8"
  }
]
```

**build** prints an object: `out` (the absolute output path), `pages`, `notes`, `assets` (images copied), `errors`, `warnings`, `ms` (time taken) and `cache` (`hits` and `misses`).

The others: `backlinks` prints `{ id, relations, backlinks }`, where `relations` holds only the incoming direction; `resolve` prints `{ id, path }`, or `null` when nothing matches; `stats` prints `{ stats, types, clusters, lint }`.
