# Clio Markdown

CommonMark + GFM (tables, task lists, strikethrough, autolinks, footnotes) plus the extensions below.
Raw HTML is dropped, so do not use it for layout; use callouts and directives.

## Frontmatter

| Field | Meaning |
|---|---|
| `id` | Global id; default is the file name without `.md`. Use kebab-case. |
| `title` | Default: the first `# heading`, else the id. |
| `type` | `topic` `concept` `entity` `source` `question` `journal` `note`, plus types from clio.toml. Default: from the folder. |
| `summary` | One sentence. Shown in lists, search results and link previews. |
| `tags` | List; nested with `/`: `compilers/frontend`. |
| `aliases` | Other names links may use. |
| `status` | `seed` → `draft` → `stable` → `archived`. |
| `created` `updated` `reviewed` | `YYYY-MM-DD`. Old `reviewed`/`updated` gives a `stale` notice. |
| `rel` | Typed relations: `rel: { part-of: x, depends-on: [a, b] }`. |
| `raw` `sha256` | On source notes: the file in `raw/` and its hash (written by `clio ingest`). |
| `lang` | Normally from the file name (`x.en.md`). |
| `translation-of-hash` | On translations: hash of the source version that was translated. |

Any other key is kept and can be used in queries.

## Links

| Write | Result |
|---|---|
| `[[pratt-parser]]` | link showing the target's title |
| `[[pratt-parser\|Pratt]]` | custom text (in tables escape the pipe: `\|`) |
| `[[pratt-parser#Binding power]]` | link to a heading |
| `[[pratt-parser^claim-1]]` | link to a block |
| `[[#Binding power]]` | heading on the same page |
| `[[depends-on::tokenizer]]` | typed relation |
| `[text](../concepts/tokenizer.md)` | Markdown link to a file; also counts as a link |
| `![[pratt-parser]]` `![[pratt-parser#Usage]]` `![[x^b1]]` | embed a note, section or block (alone on its line) |
| `![[diagram.png]]` `![alt](../assets/a.png)` | image |

Resolution of `[[target]]`: id → alias → title → path; case-insensitive; spaces and `_` count as `-`.
A target that matches nothing is a wanted note (warning `wanted`); a target matching several notes by alias or title
gives `ambiguous-link`: use the id.

Relations (clio.toml can add more with `[[relations]]`):

| relation | the target shows |
|---|---|
| `depends-on` | `used-by` |
| `part-of` | `has-part` |
| `supports` | `supported-by` |
| `source` | `cited-by` |
| `extends` | `extended-by` |
| `example-of` | `has-example` |
| `contradicts` | `contradicts` (symmetric) |
| `see-also` | `see-also` (symmetric) |

## Block ids and tags

- ` ^claim-1` at the end of a paragraph or list item names it; `^claim-1` alone on the next line names the block above.
- `#tag` or `#tag/sub` in text (not in code or links; needs a non-digit character), plus frontmatter `tags`.

## Callouts

```markdown
> [!note] Title
> Body.

> [!warning]- Folded (closed)
> [!tip]+ folded open
```

Types: note abstract summary info todo tip hint important success question warning attention caution failure danger
error bug example quote. Other names work with the default style.

## Directives

```markdown
::::tabs
:::tab{title="Rust"}
…
:::
:::tab{title="TypeScript"}
…
:::
::::
```

`tabs`/`tab{title=…}`, `cards`/`card{title=…}`, `steps` (numbers the ordered list or `###` headings inside),
`details{title=… open}`, `columns`/`column{width=2}`, and admonitions `:::note Title` (callout names, `fold=closed|open`).
Nest by giving the outer fence more colons. The opening line cannot contain `:` in the title. A `:::` line inside a
code block inside a directive closes the directive: use a longer outer fence around such examples.

## Code, math, diagrams, charts

- ```` ```rust title="src/lib.rs" {2,4-6} ```` → title bar, highlighted lines; `diff` for diffs.
- `$x^2$` inline, `$$…$$` display (KaTeX).
- ```` ```mermaid ```` diagrams.
- ```` ```chart ```` with YAML (`type: bar|line`, `title`, `x: [...]`, `series: [{name, data: [...]}]`, `unit`) or CSV
  with a header row (first column = x).

## Queries

````markdown
```clio-query
type = concept AND tag = parsing
SORT updated DESC
LIMIT 20
SHOW table
FIELDS title, summary, updated
```
````

`[WHERE] expr [SORT field [ASC|DESC], …] [LIMIT n] [SHOW list|table|cards] [FIELDS a, b]`. Operators
`= != ~ !~ > < >= <=` (`~` is case-insensitive substring), joined with `AND`, `OR`, `NOT` and parentheses. Fields:
`id title type tag status lang path folder updated created reviewed words in out summary` and any frontmatter key.
`tag = rust` also matches `rust/async`. Results are computed at build time; a note listed only by a query is still an
orphan, so link hub notes explicitly.
