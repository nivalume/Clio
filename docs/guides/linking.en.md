---
title: Linking
summary: Link forms, typed relations and inverse labels, backlinks, wanted notes, Markdown links, resolution rules, and why the syntax looks this way.
tags: [links, graph]
rel:
  part-of: index
  see-also: [knowledge-graph, syntax-cheatsheet]
updated: 2026-10-13
translation-of-hash: "2eda070cbee0"
---
# Linking

Links are the backbone of a Clio vault. Each link is resolved to one specific note at build time and can carry a relation type; the linked page automatically shows who points to it. Linking to a note that doesn't exist yet is fine: it becomes a wanted note. This page [[depends-on::writing-notes]], which covers where ids, titles and aliases come from.

## Link forms

The "Renders as" column holds real links to other pages of this handbook.

| Syntax | Renders as | Notes |
|---|---|---|
| `[[vault-layout]]` | [[vault-layout]] | Shows the target's title |
| `[[vault-layout\|custom text]]` | [[vault-layout\|custom text]] | Shows the text after the `\|` |
| `[[Getting started]]` | [[Getting started]] | Link by title or alias; resolves to the same note |
| `[[vault-layout#Ids and paths]]` | [[vault-layout#Ids and paths]] | Links to a section; shows "Title › Section" |
| `[[vault-layout^ids-stable]]` | [[vault-layout^ids-stable]] | Links to a paragraph with a block id |
| `[[#Embeds]]` | [[#Embeds]] | A section on this page |
| `[[see-also::knowledge-graph]]` | [[see-also::knowledge-graph]] | Typed link: renders like a plain link and also records the relation |
| `[Vault layout](vault-layout.md)` | [Vault layout](vault-layout.md) | Standard Markdown link; counts as a link too |

Section names are case-insensitive and spaces equal `-`. Block id syntax is in [[rich-content#Block ids]].

## Embeds

A paragraph that contains only `![[…]]` embeds the target in the current page:

| Syntax | Embeds |
|---|---|
| `![[id]]` | The whole note |
| `![[id#Section]]` | One section, up to the next heading of the same or a higher level |
| `![[id^block]]` | One paragraph or list item |
| `![[image.png]]`, `![[image.png\|caption]]` | An image, looked up by file name anywhere in the vault |

The source of the next paragraph is `![[vault-layout^ids-stable]]`:

![[vault-layout^ids-stable]]

Embeds nest at most three levels deep, and loops are cut off with a note. An embed is a reference, not a copy: when the original changes, every page that embeds it changes with the next build.

## Typed relations

A plain link only says two notes are related. A typed link also says how. There are two ways to write one, with the same effect.

In the body, when the relation is itself a statement:

```markdown
Vector search [[depends-on::embedding]], and its results [[contradicts::keyword-only-search]].
```

In the frontmatter under `rel`, for relations of the note as a whole, such as where it belongs:

```yaml
rel:
  part-of: search
  depends-on: [embedding, ann-index]
  source: "[[robertson-2009]]"
```

A value can be an id, a list of ids, or the `[[id]]` form. Quote the `[[id]]` form, or YAML reads it as a nested list.

The built-in relations:

| Relation | Inverse (shown on the target) | Labels (en / zh) | When to use |
|---|---|---|---|
| `depends-on` | `used-by` | depends on / used by (依赖 / 被依赖) | Understanding or building A needs B first |
| `part-of` | `has-part` | part of / has part (属于 / 包含) | A is part of B, or belongs to topic B |
| `supports` | `supported-by` | supports / supported by (支持 / 被支持) | A is evidence or an argument for B |
| `source` | `cited-by` | source / cited by (来源 / 被引用) | A's content comes from B, usually a source note |
| `extends` | `extended-by` | extends / extended by (扩展 / 被扩展) | A builds on B and adds to it |
| `example-of` | `has-example` | example of / has example (示例 / 有示例) | A is an instance of B |
| `contradicts` | (symmetric) | contradicts (矛盾) | A and B reach conflicting conclusions |
| `see-also` | (symmetric) | see also (参见) | Worth reading together, with no more specific relation |

A relation name that isn't declared gives an `unknown-relation` warning. `part-of` must not form a cycle, or you get `part-of-cycle`. You can declare more relations in `clio.toml`; see [[customizing]].

## Inverse labels and backlinks

Backlinks are computed, never stored twice. When A writes `[[depends-on::B]]`, the relation exists only in A's file; at build time the engine reverses it and B's page shows:

```text
used by ← A
```

Every relation declares an inverse name and a label for each direction, so B's page reads "used by", not "depends on". Symmetric relations (`contradicts`, `see-also`) show the same label on both sides. You can also write from the other end: `[[used-by::A]]` in B has the same effect as `[[depends-on::B]]` in A.

Plain links appear in the target's "Linked from" list, each with the text around the link, so you can see in what context another note mentions this one without opening it. A typed link appears only under its relation label, not again in this list.

This page's frontmatter says `part-of: index`, so the home page [[index]] lists this page under "has part". On the command line, `clio backlinks` shows the same information:

```text
$ clio backlinks embedding
used by
  Vector search vector-search
linked from (1)
  Semantic search semantic-search
    At query time [[embedding]] turns the question into a vector.
```

[[knowledge-graph]] describes how relations and backlinks form the knowledge graph.

## Wanted notes

A link to a missing note is not an error. Such a link is a wanted note:

- on the page it is styled as not yet written and points to the site's "not written yet" page;
- in the graph it is a ghost node, so you can see which notes are waiting for it;
- `clio check` reports a `wanted` warning, and `clio context` lists it at the end of its output.

Writing the link first and the note later is the normal way to work: when you reach a concept that has no note yet, write `[[bm25]]` and carry on. The more notes link to a wanted note, the sooner it is worth writing; for an agent the list is a to-do list. If you are only mentioning a word and don't intend to write a note about it, don't link it.

## Markdown links

A standard Markdown link to a `.md` file counts as a link, and goes into the graph and the backlinks just like `[[ ]]`:

```markdown
[Vault layout](vault-layout.md)
[Ids and paths](../guides/vault-layout.md#ids-and-paths)
```

The path is relative to the current file. If nothing is found at that path (say the target was moved), Clio tries the file name as an id, so the link still works on the Clio site; when browsing the source on GitHub, though, it is broken. Links to `https://` are ordinary external links.

Use Markdown links when the source files must be clickable on GitHub, and `[[ ]]` everywhere else.

## Resolution rules

`[[target]]` is looked up in this order, and the first match wins:

1. id: the file name, or `id` in the frontmatter;
2. alias: the frontmatter `aliases`;
3. title: the `title` of any language version.

A target containing `/` is a path, such as `[[notes/concepts/bm25]]`, matched relative to the vault root; `.md` is optional. Markdown links try the path first, then the file name.

Matching is case-insensitive, and spaces and `_` count as `-`, so `[[Vector Search]]`, `[[vector_search]]` and `[[vector-search]]` all point to the same note. If an alias or title matches several notes, you get an `ambiguous-link` warning and the first note is used. `clio resolve <text>` shows where a name resolves to.

Links resolve the same way in every language; on an English page a link goes to the English version of its target; see [[multilingual]].

## Why this syntax

There are two common ways to write links: Obsidian's `[[ ]]` and standard Markdown links. Clio keeps the first and adds what it lacks:

| | Obsidian `[[ ]]` | Markdown link | Clio `[[ ]]` |
|---|---|---|---|
| Typing | Short | Long, needs a relative path | Short |
| Familiar to language models | Yes | Yes | As Obsidian, plus an optional `relation::` prefix |
| Resolved by | File name | Relative path | Id, alias, title |
| After moving a file | Works | Broken | Works |
| Relation type | None | None | Yes, with declared inverse labels |
| Backlinks | In the editor | None | Computed at build time, shown on the site |
| Sections and blocks | Yes | Section anchors only | Yes, anchors checked at build time |
| Embeds | Yes | Images only | Yes, up to three levels |
| Clickable on GitHub | No | Yes | No |
| Missing target | Created on click | 404 | Wanted note, listed by `clio check` |

The reasons for `[[ ]]`:

- **It is short.** Writing doesn't stop for paths. Language models have seen the syntax in a great many Obsidian notes and rarely get it wrong.
- **It is Obsidian-compatible.** A Clio vault opens and edits in Obsidian, and `clio init --adopt` takes over an existing Obsidian vault.
- **It resolves by stable names.** Links point to ids, aliases or titles, not to paths, so reorganising folders breaks nothing.
- **Everything added is optional.** Without a `relation::` prefix it is a plain Obsidian link; with one, the graph gains a named, directed edge.
- **Unresolved links are useful.** They are not 404s but a list of notes to write, for people and agents alike.

Markdown links stay because some files need to read well on GitHub itself, such as documentation inside a repository.
