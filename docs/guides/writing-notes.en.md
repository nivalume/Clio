---
title: Writing notes
summary: Frontmatter fields, the seven built-in types, the status lifecycle, summaries, clio new and templates, aliases, tags and dates.
tags: [notes, frontmatter]
rel:
  part-of: index
  see-also: [linking, syntax-cheatsheet]
updated: 2026-10-13
translation-of-hash: "5bd9ec16d35a"
---
# Writing notes

A note is a Markdown file: YAML frontmatter at the top with the title, type, tags, relations and other metadata, then the body. This page covers every frontmatter field and the conventions for writing a good note. It [[depends-on::vault-layout]]: a note's default type comes from the folder it is in.

## A complete note

```markdown title="notes/concepts/bm25.md"
---
title: BM25
summary: A ranking function that scores keyword matches by term frequency and document length; the usual full-text search baseline.
aliases: [Okapi BM25]
tags: [search, ranking]
status: draft
created: 2026-10-10
updated: 2026-10-13
rel:
  part-of: search
  source: robertson-2009
---
# BM25

BM25 scores each query term and adds the scores up. The more often a term occurs in a
document, the higher its score, but the growth saturates; the longer the document, the
less a single term weighs.

It complements [[vector-search]]: good at exact terms, poor at paraphrases.
```

Every frontmatter field is optional; missing fields take the defaults below.

## Fields

| Field | Default | Purpose |
|---|---|---|
| `id` | file name without `.md` | Unique identifier that links use. Usually omitted so the file name serves |
| `title` | first level-1 heading, else the id | Shown on the page, as link text, in lists and in search results |
| `type` | folder mapping, else `note` | The note type; see [[#Types]] |
| `aliases` | none | Other names that links may use; see [[#Aliases]] |
| `tags` | none | Tags, merged with tags in the body; see [[#Tags]] |
| `status` | none | `seed`, `draft`, `stable` or `archived`; see [[#Status]] |
| `summary` | the `description` field, else the first paragraph | One-sentence summary; see [[#Summaries]] |
| `created` | none | Creation date, `YYYY-MM-DD` |
| `updated` | none | Date of the last substantive change |
| `reviewed` | none | Date the content was last checked; see [[#Dates and staleness]] |
| `rel` | none | Typed relations: relation name → id or list of ids; see [[linking#Typed relations]] |
| `lang` | from the file name | Language, such as `en`; rarely written; see [[multilingual]] |
| `translation-of-hash` | none | Which version of the original a translation follows; translations only; see [[multilingual]] |

Any other field is kept as written and can be used in queries. Give paper notes a `year: 2017` and you can filter with `year >= 2015`; see [[queries]].

## Types

A type says what a note is, not what it is about. There are seven built in:

| Type | Default folder | Use |
|---|---|---|
| `topic` | `notes/topics/` | Hub notes: an overview of an area that organises related notes |
| `concept` | `notes/concepts/` | One concept, method or principle |
| `entity` | `notes/entities/` | People, organisations, products, projects |
| `source` | `notes/sources/` | Summary and key points of one raw source, pointing at the original in `raw/` |
| `question` | `notes/questions/` | Answered questions, comparisons, analyses |
| `journal` | `journal/` | Daily notes |
| `note` | anywhere else | Unclassified |

The type sets the icon and colour on the page and the node shape in the graph, and it is the most common filter in queries. Each type is written differently: a source note stays faithful to the original, a concept note combines several sources, and a topic note is mostly links and guidance.

To add a type (such as `paper`) or make fields required for a type, configure it in `clio.toml`; see [[customizing]].

## Status

`status` says how mature a note is:

| Status | Meaning |
|---|---|
| `seed` | A title, a sentence or two or a few links; it holds the place |
| `draft` | The content has taken shape but hasn't been checked and may have gaps |
| `stable` | Checked against its sources; other notes can rely on it |
| `archived` | Outdated or superseded; kept for history and old links |

The normal path is seed → draft → stable, and archived once it is out of date. `clio ingest` creates source notes as `draft`. The engine doesn't enforce the transitions; status is for queries and maintenance, for example listing every note that is still a seed:

```text
status = seed SORT updated
```

## Summaries

`summary` states the note's conclusion or definition in one sentence. It appears in query lists, previews, search results and backlink lists, and in the neighbour list that `clio context` hands to agents. Agents usually read the summary before deciding whether to open a note, which makes summaries the most-read text in the vault.

How to write one:

- State the conclusion, not "This note covers…". "BM25 scores by term frequency and document length" beats "Notes on BM25".
- One sentence, under about 20 words.
- No links or formatting; summaries are shown as plain text.

Without a `summary`, Clio uses the `description` field, and failing that the first paragraph of the body, cut at 160 characters. An automatic summary is often half a sentence, so write one by hand for any note that matters.

## Creating notes with clio new

```bash
clio new concept "BM25" --id bm25 --tags search,ranking
clio new topic "Search" --id search
clio new concept "BM25" --id bm25 --lang en     # English version of an existing note
```

`clio new <type> <title>` reads `templates/<type>.md`, fills in the variables and saves the note in that type's folder. The variables:

| Variable | Value |
|---|---|
| `{{title}}` | the title on the command line |
| `{{id}}` | the `--id` value, derived from the title by default |
| `{{date}}` | today, `YYYY-MM-DD` |
| `{{lang}}` | the `--lang` value, the default language otherwise |
| `{{type}}` | the type name |

A concept template:

```markdown title="templates/concept.md"
---
title: "{{title}}"
summary: ""
tags: []
status: seed
created: {{date}}
updated: {{date}}
---
# {{title}}

One-sentence definition.

## How it works

## Examples

## Sources
```

`title` is quoted because a title may contain a colon, which would make the filled-in YAML invalid. Templates are ordinary files; change them to suit how you write.

## Aliases

`aliases` lists other names for the note: abbreviations, full names, names in other languages, old names.

```yaml
aliases: [Okapi BM25, BM-25]
```

A link to an alias resolves to the note: `[[Okapi BM25]]` shows the note's title, "BM25". Search matches aliases too. If an alias belongs to several notes, `clio check` reports `ambiguous-link` and the link goes to the first one. When unsure, `clio resolve <text>` shows which note a name points to.

## Tags

Tags classify notes across types and topics. Put them in the frontmatter `tags`, or write `#search` in the body; both are merged.

- Tags can be hierarchical: `search/vector`. The query `tag = search` also matches `search/vector`.
- A tag in the body must contain a non-digit, so `#2024` is not a tag; a `#` in code, links and headings doesn't count either.
- Every tag has its own page listing the notes that carry it.

Tags don't replace links. To say how two notes relate, link them; a tag only answers "what kind of note is this".

## Dates and staleness

`created`, `updated` and `reviewed` are all `YYYY-MM-DD`:

- `updated`: set to today when the content changes substantively.
- `reviewed`: set to today when you have reread and checked the note and it is still right, even if nothing changed.

When `reviewed` (or `updated` if there is no `reviewed`) is older than `stale_days` in `clio.toml` (180 days by default), `clio check --all` reports a `stale` notice. Knowledge goes out of date; this notice finds the notes that need rereading. After checking one, set `reviewed` to today.

A query finds notes nobody has touched in a while:

```text
updated < 2026-01-01 AND status != archived SORT updated
```
