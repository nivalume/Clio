---
name: clio
description: Maintain a Clio knowledge base (a folder with clio.toml) the way Karpathy's "LLM Wiki" describes - ingest a source and update the notes it touches, answer questions from the notes and file good answers back, lint the vault, translate notes. Use whenever the task reads or writes notes in a Clio vault, adds material to it, or asks a question the vault should answer.
---

# Clio knowledge base

A Clio vault is Markdown notes with typed links, built into a static site. You maintain it together with a person:
they choose sources and ask questions; you read, write, cross-link and check. The vault's own conventions are in
`AGENTS.md` at its root; read it first, it overrides the defaults below.

## Layout

```
clio.toml        title, languages, note types, folder → type, relations
AGENTS.md        this vault's conventions (CLAUDE.md points to it)
index.md         home page; its lists come from clio-query blocks, do not maintain them by hand
log.md           append-only log: "## [YYYY-MM-DD] op | title" and a list of changed notes
raw/             original sources, READ-ONLY (sha256 recorded at ingest; editing one is an error)
notes/sources/   one note per raw item (type source, `raw:` and `sha256:` in frontmatter)
notes/concepts/  notes/entities/  notes/topics/ (hubs, overviews)  notes/questions/ (answers filed back)
templates/       one template per type, used by `clio new`
```

Ids are global: the file name without `.md`, or frontmatter `id`. Folders only decide where a file lives and its
default type. Topics live in hub notes (type `topic`), hierarchical tags and links, not in folders.

## Commands

Run `clio` from the vault root (or pass `--dir`). Read commands take `--json`; prefer it.

| Need | Command |
|---|---|
| Find notes | `clio search "<words>" --json` (BM25; Chinese and English) |
| Read a note with its neighbourhood | `clio context <id> --hops 2` (source text + related notes + wanted links) |
| Relations and backlinks | `clio show <id> --json`, `clio backlinks <id> --json` |
| Which note a name points to | `clio resolve "<text>"` |
| New note from a template | `clio new <type> "<title>" [--id kebab-id] [--tags a,b]` |
| Add a source | `clio ingest <file-or-url> --title "<title>"` |
| Rename an id everywhere | `clio mv <old-id> <new-id>` |
| Log an operation | `clio log <op> "<title>"` |
| Check the vault | `clio check --json` (`--all` adds notices) |
| Translations to do | `clio translate-status --json`; after translating, `clio translate-status --pin <id>` |

## Writing notes

Frontmatter (all optional except what `clio.toml` marks required for the type):

```yaml
---
title: Pratt parser
type: concept            # default comes from the folder
summary: One sentence that states the point, shown in lists, search and link previews.
tags: [parsing, compilers/frontend]
aliases: [Pratt parsing, top-down operator precedence]
status: draft            # seed | draft | stable | archived
rel:
  part-of: parsing
  depends-on: [tokenizer]
updated: 2026-10-13
---
```

Links and relations (details in [references/syntax.md](references/syntax.md)):

- `[[id]]` shows the target's title; `[[id|text]]`; `[[id#Heading]]`; `[[id^block-id]]`.
- Typed: `[[depends-on::id]]` in prose, or `rel:` in frontmatter. Built-in relations: `depends-on`, `part-of`,
  `supports`, `source`, `extends`, `example-of`, `contradicts`, `see-also`. The target shows the inverse
  (used-by, has-part, …) automatically: never write a backlink by hand.
- Link to a note that does not exist yet when it deserves one: it becomes a "wanted" note, a to-do for later.
- End a paragraph or list item with ` ^claim-1` to give it a block id others can cite: `[[source-id^claim-1]]`.
- `![[id]]` or `![[id#Heading]]` alone on a line embeds that note or section.

Rules:

- One idea per note. Prefer updating an existing note over creating a near-duplicate: search first.
- Write `summary` as the conclusion, not "this note describes…".
- Every claim taken from a source links to it: `[[source::source-id]]` or `[[source-id^claim-n]]`.
- When new material conflicts with a note, add `[[contradicts::id]]` and state both positions; do not silently overwrite.
- Write in the vault's default language (first of `locales` in clio.toml) unless AGENTS.md says otherwise.
- Never edit or delete files in `raw/`.

## Workflows

Full steps and examples: [references/workflows.md](references/workflows.md).

**Ingest a source**
1. `clio ingest <file|url> --title "<title>"` copies it to `raw/`, records sha256, creates a draft source note and logs it.
2. Read the original. In the source note write the summary and the key claims, each ending with a block id. Record what the source says, without commentary. Set `status: stable` when done.
3. `clio search` and `clio context` to find the notes it touches; a source usually touches 10–15.
4. Update concepts, entities and topics; create notes for important new ideas; link every new claim back to the source.
5. `clio check --json`: fix errors; resolve new `wanted` and `missing-anchor` warnings (write the note or fix the link).
6. Under the ingest entry in `log.md`, list the notes created and updated. Hand the diff to the person for review.

**Answer a question**
1. `clio search` the key terms, read summaries, then `clio context <id> --hops 2` for the best one or two hits.
2. Answer with links to the notes you relied on. Say what the vault does not cover.
3. If the answer has lasting value (a comparison, an analysis), file it: `clio new question "<question>"`, link its sources, link it from the relevant topic note.
4. `clio log query "<question>"`.

**Lint**
1. `clio check --json --all`.
2. `wanted` linked from several notes → write it; a passing mention → unlink. `orphan` → link it from a topic, or ask whether it is still needed. `stale` → re-check against sources, then update `reviewed`. Contradictions → read both sources, resolve or keep both views.
3. Also look for what the engine cannot see: duplicate notes for one idea, summaries that no longer match the body, notes that should be split.
4. `clio log lint "<summary of changes>"`.

**Translate**
1. `clio translate-status --json` lists missing and stale translations.
2. Translation of `x.md` into English is `x.en.md` next to it, same id; keep links as ids.
3. Update the translation to match the source, then `clio translate-status --pin <id>`.

## Before you finish

- `clio check` reports 0 errors.
- `log.md` has an entry for what you did, with the notes you changed.
- You did not touch `raw/`.
