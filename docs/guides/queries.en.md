---
title: Queries
summary: "The clio-query language: syntax, operators, fields and display modes, with examples that run on this handbook."
tags: [query, syntax]
rel:
  part-of: index
  see-also: [syntax-cheatsheet, writing-notes]
updated: 2026-10-13
translation-of-hash: "f0c93821cfef"
---
# Queries

A `clio-query` code block runs at build time and writes its result straight into the page: a list, a table or a set of cards. Home-page catalogs, topic hubs and maintenance lists are all built this way. When you add or change notes, the lists update with the next build and never go stale. Every example on this page runs on this handbook, so what you see is the handbook as it was when the site was built.

## A first query

List every guide, sorted by title, as a table with the summaries:

````markdown
```clio-query
type = guide SORT title SHOW table FIELDS summary
```
````

```clio-query
type = guide SORT title SHOW table FIELDS summary
```

## Syntax

```text
[WHERE] <condition> [SORT field [ASC|DESC], …] [LIMIT n] [SHOW list|table|cards] [FIELDS a, b, …]
```

| Clause | Does | When omitted |
|---|---|---|
| `WHERE <condition>` | Filters; the word `WHERE` itself is optional | All notes |
| `SORT field [ASC\|DESC], …` | Sorts by one or more fields, earlier fields first; ascending by default | By title |
| `LIMIT n` | Shows at most n results | No limit |
| `SHOW list\|table\|cards` | Display mode; see [[#Display modes]] | `list` |
| `FIELDS a, b, …` | Table columns | `type, updated` |

Keywords are case-insensitive, and a query can sit on one line or span several. A condition is `field operator value`; combine conditions with `AND`, `OR`, `NOT` and parentheses. `NOT` binds tightest, then `AND`, then `OR`. Quote values that contain spaces or special characters: `title ~ "vector search"`.

## Operators

| Operator | Meaning | Example |
|---|---|---|
| `=` | equals, case-insensitive | `type = concept` |
| `!=` | does not equal | `status != archived` |
| `~` | contains the substring, case-insensitive | `title ~ search` |
| `!~` | does not contain the substring | `path !~ drafts` |
| `>` `<` `>=` `<=` | compares: as numbers when both sides are numbers, otherwise as text | `words > 500`, `updated >= 2026-01-01` |

Dates are `YYYY-MM-DD`, so comparing them as text puts them in time order.

For multi-valued fields such as tags, a condition holds if any value satisfies it; `!=` and `!~` require that no value does. `tag = search` also matches subtags such as `search/vector`. When a note lacks a field, `=` fails and `!=` holds, so `status != archived` includes notes with no status.

## Fields

| Field | Value |
|---|---|
| `id` | The note id |
| `title` | Title |
| `type` | Type |
| `tag` (or `tags`) | Tags; multi-valued |
| `status` | Status |
| `lang` | Language of the version used |
| `path` | File path relative to the vault root, such as `guides/queries.md` |
| `folder` | The file's folder, such as `guides` |
| `created`, `updated`, `reviewed` | Dates |
| `words` | Word count |
| `in` (or `backlinks`) | Number of links pointing to the note |
| `out` (or `links`) | Number of links going out of the note |
| `summary` | Summary |
| any other name | The frontmatter field of that name |

Custom fields work by name. Give paper notes `year: 2017` and `venue: NeurIPS`, and you can write `year >= 2015 AND venue = NeurIPS`.

## Display modes

| `SHOW` | Displays |
|---|---|
| `list` | A list: title links followed by the summary, cut at 90 characters |
| `table` | A table: title links in the first column, the `FIELDS` in the others (`type, updated` by default) |
| `cards` | Cards: title link and the full summary |

When nothing matches, the block says "No matching notes".

## Examples

### Pages with a tag

````markdown
```clio-query
tag = cli
```
````

```clio-query
tag = cli
```

### Reference pages as cards

````markdown
```clio-query
type = reference SHOW cards
```
````

```clio-query
type = reference SHOW cards
```

### Combined conditions

Guides or reference pages tagged `cli` or `config`:

````markdown
```clio-query
(type = guide OR type = reference) AND (tag = cli OR tag = config)
SHOW table FIELDS type, tags
```
````

```clio-query
(type = guide OR type = reference) AND (tag = cli OR tag = config)
SHOW table FIELDS type, tags
```

### The longest pages

````markdown
```clio-query
SORT words DESC LIMIT 5 SHOW table FIELDS type, words
```
````

```clio-query
SORT words DESC LIMIT 5 SHOW table FIELDS type, words
```

### The least-linked pages

Useful in maintenance, to find notes that need more links:

````markdown
```clio-query
NOT id = index SORT in, title LIMIT 5 SHOW table FIELDS in, out
```
````

```clio-query
NOT id = index SORT in, title LIMIT 5 SHOW table FIELDS in, out
```

## On the home page

`index.md` lists notes by type with queries, so nobody has to maintain the home page by hand. This handbook's home page works that way, and so does every generated vault; see [[vault-layout#index.md and log.md]].

## When a query is wrong

A broken query shows its error on the page where the result would be, and `clio check` reports a `query` warning with the line number:

```text
notes/topics/search.md
  12   warning query                 query 1: expected a value after `type`, found end of query
```

## Things to know

- Query results are not links. A note that only appears in query results has no edge in the graph, and `clio check --all` may still call it an orphan. List the important entries of a topic note with written links.
- Each note is one row, however many language versions it has. On an English page, notes with an English version show its title, summary and fields.
- Queries run at build time and the static page stores the result; the browser never runs a query.
