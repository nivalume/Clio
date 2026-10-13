---
title: Syntax cheat sheet
summary: All of Clio Markdown on one page — what you write on the left, what you get on the right, and where each feature is explained.
tags: [syntax, reference]
rel:
  part-of: index
  see-also: [writing-notes, linking, rich-content]
updated: 2026-10-13
translation-of-hash: "0b1a358a9f3c"
---
# Syntax cheat sheet

Clio Markdown is CommonMark plus GFM plus a set of extensions. This page squeezes all of it into tables: "You write" is the source, "You get" is the result (rendered live where possible), and "Details" points to the guide that explains it.

## Basic formatting

| You write | You get | Details |
|---|---|---|
| `**bold**` `*italic*` | **bold** *italic* | [[rich-content]] |
| `**加粗**，followed by CJK punctuation` | **加粗**，followed by CJK punctuation | [[rich-content]] |
| `~~strikethrough~~` | ~~strikethrough~~ | [[rich-content]] |
| `==highlight==` | ==highlight== | [[rich-content]] |
| `` `inline code` `` | `inline code` | [[rich-content]] |
| `- [ ] to do`, `- [x] done` | A task list with checkboxes | [[rich-content]] |
| `https://example.com` | An autolink: https://example.com | [[rich-content]] |
| `Text[^1]` and `[^1]: The note.` | A superscript number; footnotes are listed at the end of the page | [[rich-content]] |
| `<b>bold</b>`, `<script>` | Nothing: raw HTML is always dropped | [[rich-content]] |

A pipe inside a table cell must be written `\|`, otherwise it splits the cell — inside code too.

Description lists: the term on its own line, a blank line, then the definition on a line starting with `: `.

```markdown
BM25

: A ranking function based on term frequency and document length.
```

## Links

| You write | You get | Details |
|---|---|---|
| `[[queries]]` | [[queries]] (shows the target's title) | [[linking]] |
| `[[queries\|query blocks]]` | [[queries\|query blocks]] | [[linking]] |
| `[[cli#clio check]]` | [[cli#clio check]] (title › section) | [[linking]] |
| `[[syntax-cheatsheet^resolve-order]]` | [[syntax-cheatsheet^resolve-order]] (a link to a block) | [[linking]] |
| `[[#Embeds]]` | [[#Embeds]] (a section of this page) | [[linking]] |
| `[text](../guides/queries.md#anchor)` | A standard Markdown link; it also counts for backlinks and the graph | [[linking]] |
| `[[a note not written yet]]` | A link to the "wanted" page, a ghost node in the graph, a `wanted` warning | [[linking]] |

`[[target]]` is looked up as id → alias → title → path, case-insensitive, with spaces and `_` treated as `-`. ^resolve-order

The "Resolution rules" section of [[linking]], embedded:

![[linking#Resolution rules]]

## Typed relations

| You write | You get | Details |
|---|---|---|
| `[[depends-on::tokenizer]]` | A link showing the target's title; the target shows "used by ← this page" | [[linking]] |
| `[[used-by::parser]]` | Inverse names work too; same as the other note writing `depends-on` | [[linking]] |
| frontmatter `rel: { part-of: compilers }` | The same relation, kept out of the body | [[linking]] |
| frontmatter `rel: { see-also: [a, b] }` | One relation can point to several notes | [[linking]] |
| `[[implements::raft]]` (undeclared) | A plain link plus an `unknown-relation` warning | [[config]] |

Built-in relations (the source page shows the first label, the target page the second):

| Relation | Inverse | Labels |
|---|---|---|
| `depends-on` | `used-by` | depends on / used by |
| `part-of` | `has-part` | part of / has part |
| `supports` | `supported-by` | supports / supported by |
| `source` | `cited-by` | source / cited by |
| `extends` | `extended-by` | extends / extended by |
| `example-of` | `has-example` | example of / has example |
| `contradicts` | symmetric | contradicts |
| `see-also` | symmetric | see also |

Why it works this way: [[knowledge-graph#Inverse labels]].

## Embeds

| You write (as its own paragraph) | You get | Details |
|---|---|---|
| `![[pratt-parser]]` | The whole note's body, inlined here | [[linking]] |
| `![[pratt-parser#associativity]]` | Only that section | [[linking]] |
| `![[pratt-parser^claim-1]]` | Only that block | [[linking]] |
| `![[diagram.png]]` | An image, found by file name anywhere in the vault | [[rich-content]] |
| `![[diagram.png\|diagram]]` | An image with alt text | [[rich-content]] |
| `![diagram](../assets/a.png)` | An image by relative path, copied into the site | [[rich-content]] |

Embeds nest at most three levels deep. Loops such as A embedding B embedding A are cut off rather than expanded forever. ^embed-limits

## Block ids and tags

| You write | You get | Details |
|---|---|---|
| `^claim-1` at the end of a paragraph or list item (after a space) | The block can be linked and embedded as `[[id^claim-1]]` | [[rich-content]] |
| `^table-1` alone on the line after a table, code block or quote | An id for the block before it | [[rich-content]] |
| `#rust` in text | The tag `rust` | [[writing-notes]] |
| `#rust/async` in text | A hierarchical tag; filtering by `rust` includes it | [[writing-notes]] |
| frontmatter `tags: [rust, parser]` | Merged with the tags in the text | [[writing-notes]] |

A `#` inside code or a link is not a tag. A tag needs at least one non-digit character, so `#2024` is not a tag. ^tag-rule

## Callouts

| You write | You get | Details |
|---|---|---|
| `> [!note] Title` followed by `> text` | A box with a title and an icon | [[rich-content]] |
| `> [!warning]- Title` | Folded closed by default | [[rich-content]] |
| `> [!tip]+ Title` | Foldable, open by default | [[rich-content]] |
| `> [!recipe]` | A custom type with the default style and a `callout-type` notice | [[rich-content]] |

Known types: `note`, `abstract`/`summary`, `info`, `todo`, `tip`/`hint`, `important`, `success`, `question`, `warning`/`attention`, `caution`, `failure`, `danger`/`error`, `bug`, `example`, `quote`.

::::tabs
:::tab{title="You write"}
```markdown
> [!tip] Search first
> Run `clio search` before creating a note, to avoid duplicates.
```
:::
:::tab{title="You get"}
> [!tip] Search first
> Run `clio search` before creating a note, to avoid duplicates.
:::
::::

## Directives

| You write | You get | Details |
|---|---|---|
| `:::note Title` … `:::` | The same box as a callout | [[rich-content]] |
| `:::warning{title="…" fold=closed}` | Folded closed by default; `fold=open` makes it foldable and open | [[rich-content]] |
| `::::tabs` containing several `:::tab{title="Rust"}` | Tabs | [[rich-content]] |
| `::::cards` containing several `:::card{title="…"}` | A grid of cards | [[rich-content]] |
| `:::steps` around an ordered list or `###` headings | Numbered steps | [[rich-content]] |
| `:::details{title="More" open}` | A collapsible block; `open` starts it expanded | [[rich-content]] |
| `::::columns` containing `:::column{width=2}` | Columns; `width` is relative | [[rich-content]] |
| `{title="…" .class #id key=value}` | Directive attributes | [[rich-content]] |
| `:::timeline` (unknown name) | A plain block plus an `unknown-directive` warning | [[rich-content]] |

Nest by giving the outer fence more colons. The info line (what follows `:::`) cannot contain `:`. A line `:::` inside a code block closes the enclosing directive, so when an example contains `:::`, use `::::` for the outer fence.

````markdown
::::tabs
:::tab{title="Rust"}
```rust
fn main() {}
```
:::
:::tab{title="TypeScript"}
```ts
export {};
```
:::
::::
````

## Code, math, charts

| You write | You get | Details |
|---|---|---|
| ```` ```rust ```` | Highlighted at build time by Shiki, in a light and a dark variant | [[rich-content]] |
| ```` ```rust title="src/lib.rs" {2,4-6} ```` | A title bar with the file name; lines 2 and 4–6 highlighted | [[rich-content]] |
| ```` ```diff ```` | Added and removed lines coloured | [[rich-content]] |
| `$a^2+b^2=c^2$` | $a^2+b^2=c^2$ | [[rich-content]] |
| `$$` on its own lines around a formula | Display math, rendered by KaTeX at build time | [[rich-content]] |
| ```` ```mermaid ```` | A Mermaid diagram, rendered in the browser | [[rich-content]] |
| ```` ```chart ```` with YAML or CSV | A bar or line chart drawn as SVG at build time | [[rich-content]] |

```chart
type: bar
title: New notes per week
x: [Week 1, Week 2, Week 3, Week 4]
series:
  - name: Concepts
    data: [4, 7, 5, 9]
  - name: Sources
    data: [2, 3, 6, 4]
```

The source of the chart above:

````markdown
```chart
type: bar
title: New notes per week
x: [Week 1, Week 2, Week 3, Week 4]
series:
  - name: Concepts
    data: [4, 7, 5, 9]
  - name: Sources
    data: [2, 3, 6, 4]
```
````

`type` is `bar` or `line`. CSV with a header row works in place of YAML.

## Queries

| You write | You get | Details |
|---|---|---|
| `type = concept` in a ```` ```clio-query ```` block | A list of all concept notes, sorted by title | [[queries]] |
| `tag = rust AND NOT status = archived` | Conditions combine with AND, OR, NOT and parentheses | [[queries]] |
| `title ~ parser` | `~` is a case-insensitive substring match; `!~` is its negation | [[queries]] |
| `updated >= 2026-01-01` | Comparisons `= != > < >= <=` | [[queries]] |
| `SORT updated DESC LIMIT 10` | Ordering and count | [[queries]] |
| `SHOW table FIELDS type, updated` | A table with these columns; `SHOW` takes `list`, `table` or `cards` | [[queries]] |

Full form: `[WHERE] condition [SORT field [ASC|DESC], …] [LIMIT n] [SHOW list|table|cards] [FIELDS a, b]`. Fields: `id title type tag status lang path folder updated created reviewed words in out summary`, plus any frontmatter key. `tag = rust` also matches `rust/async`.

A live example, listing this handbook's reference pages as a table:

```clio-query
type = reference
SORT title
SHOW table
FIELDS summary
```

## Frontmatter

| Field | Meaning | Default |
|---|---|---|
| `id` | Globally unique identifier; links use it | file name without `.md` |
| `title` | Title | first level-1 heading, else the id |
| `type` | Note type | from the folder mapping, else `note` |
| `aliases` | Alternative names; links may use them | none |
| `tags` | Tags | none |
| `status` | `seed`, `draft`, `stable` or `archived` | none |
| `summary` | One sentence, shown in lists, previews and search results | none |
| `created` `updated` `reviewed` | Dates as `YYYY-MM-DD`; an old `reviewed` or `updated` gives `stale` | none |
| `rel` | Typed relations: relation name → id or list of ids | none |
| `lang` | Language | from the file name |
| `translation-of-hash` | Hash of the source version a translation was made from | none |

Any other key is kept and can be queried. See [[writing-notes]].

## Multiple languages

| You write | You get | Details |
|---|---|---|
| `pratt-parser.en.md` in the same folder | The English version of `pratt-parser`, at `/en/n/pratt-parser` | [[multilingual]] |
| frontmatter `lang: en` | Sets the language directly instead of by file name | [[multilingual]] |
| `translation-of-hash: "41d07c3e9a55"` in a translation | A `translation-stale` warning once the source changes | [[multilingual]] |
| `[[pratt-parser]]` on an English page | Links to the English version if there is one, otherwise to the default language, marked as a fallback | [[multilingual]] |
