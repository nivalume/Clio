---
title: Lint codes
summary: Every code clio check reports — level, meaning, an example that triggers it, and how to fix it.
tags: [lint, reference]
rel:
  part-of: index
  see-also: [cli, agents]
updated: 2026-10-13
translation-of-hash: "ac56e85a839f"
---
# Lint codes

[[cli#clio check]] lints the whole vault and tags each problem with a code. This page lists them all: level, meaning, an example that triggers it, and the fix. An agent that runs `clio check --json` regularly and applies these fixes is the main thing that keeps a vault clean; see [[agents]].

## Levels

| Level | `level` in JSON | Shown by default | Affects the exit code |
|---|---|---|---|
| Error | `error` | yes | exit code 1 when there are errors |
| Warning | `warning` | yes | only with `--strict` |
| Notice | `info` | only with `--all` or `--level info` | no |

An error means the vault's data cannot be trusted (unreadable frontmatter, an id clash, a modified raw source). A warning means a link, relation or block does not do what you meant. A notice is a maintenance hint: a note nobody links to, a note not reviewed for a long time, a missing translation.

## Overview

| Code | Level | Meaning |
|---|---|---|
| [[#frontmatter]] | error | The frontmatter is not valid YAML |
| [[#duplicate-id]] | error | Two files use the same id in the same language |
| [[#raw-modified]] | error | A file in `raw/` changed or disappeared after it was ingested |
| [[#wanted]] | warning | Link to a note that does not exist |
| [[#missing-anchor]] | warning | The linked section or block is not in the target note |
| [[#ambiguous-link]] | warning | An alias or title matches several notes |
| [[#unknown-relation]] | warning | A relation that is not declared |
| [[#unknown-directive]] | warning | An unknown directive name |
| [[#empty-link]] | warning | An empty `[[ ]]` |
| [[#required-field]] | warning | A frontmatter field required by the note's type is missing |
| [[#translation-stale]] | warning | The source changed since the translation was made |
| [[#part-of-cycle]] | warning | `part-of` relations form a cycle |
| [[#query]] | warning | A `clio-query` block has a syntax error |
| [[#orphan]] | notice | No other note links here |
| [[#empty-note]] | notice | The note has no text |
| [[#stale]] | notice | Not reviewed for a long time |
| [[#translation-missing]] | notice | A language version is missing |
| [[#translation-unpinned]] | notice | A translation has no `translation-of-hash` |
| [[#callout-type]] | notice | A custom callout type |

## Errors

### frontmatter

The `---` block at the top of the file is not valid YAML. All of the note's metadata is lost: title, type, tags and relations fall back to their defaults.

```markdown
---
title: Pratt parser
tags: [parser, compilers
---
```

Fix: correct the YAML. The usual causes are an unclosed bracket or quote, or a value containing `: ` without quotes (`summary: Result: faster` must be written `summary: "Result: faster"`).

### duplicate-id

Two files resolve to the same id in the same language. The id is the file name without `.md`, or the frontmatter `id`; it is global and does not depend on the folder.

```text
notes/concepts/attention.md      → id attention
notes/sources/attention.md       → id attention
```

The second file is skipped, and every link to `attention` goes to the first. Fix: rename one of them; [[cli#clio mv]] also rewrites the existing links. Language versions of one note (`attention.md` and `attention.en.md`) are not duplicates.

### raw-modified

A raw source in `raw/` was modified after it was ingested: its current sha256 differs from the `sha256` recorded in the source note's frontmatter. The same error is reported when the file that `raw:` points to doesn't exist. Raw sources are read-only; the source note and every claim citing it refer to the content as ingested.

Only notes with both `raw:` and `sha256:` are checked. The check runs in the Bun CLI, not in the engine: the engine doesn't read the file system, so the CLI reads the files in `raw/` and hashes them. `clio check`, `clio build` and the `check` tool of `clio mcp` all include it.

```yaml
# notes/sources/attention-is-all-you-need.md
raw: raw/attention-is-all-you-need.pdf
sha256: 3f2a9c…e81b      # the file no longer has this hash
```

Fix: if the change or deletion was a mistake, restore the file from version control. If you really need the new version, ingest it as a new source with [[cli#clio ingest]] and update the notes that cite it.

## Warnings

### wanted

A link points to a note that does not exist. The link still renders and goes to the "wanted" page; the graph shows a ghost node. Wanted notes are an intentional to-do list, which is why this is a warning and not an error.

```markdown
The input goes to the [[tokenizer]] first.
```

Fix: write the note (`clio new concept Tokenizer --id tokenizer`), or point the link at an existing note's id, alias or title. [[cli#clio resolve]] shows where a name resolves. The lookup rules are in [[syntax-cheatsheet^resolve-order]].

### missing-anchor

A link names a section (`#heading`) or block (`^block-id`) that the target note does not have. The check uses the target's version in the linking note's language.

```markdown
See [[pratt-parser#performance]]; the result is in [[benchmarks^run-3]].
```

The link still goes to the note, just not to the exact spot. Fix: use a heading that exists in the target, or add `^run-3` at the end of the target paragraph. Renaming a heading triggers this warning on every link to it.

### ambiguous-link

The link text is not an id, but as an alias or title it matches several notes. Clio uses the first one (in id order).

```markdown
# two notes both have aliases: [attention]
See [[attention]].
```

Fix: link by the target's id, or remove the duplicate alias from one of the notes.

### unknown-relation

The relation name in `[[relation::id]]` or in frontmatter `rel:` is neither a declared relation nor the inverse name of one. The link still works, but it has no label and no inverse label.

```markdown
It [[implements::raft]].
```

Fix: declare the relation in `clio.toml` with `[[relations]]` (see [[config#relations]]), or use a built-in relation such as `depends-on` or `example-of`.

### unknown-directive

The name in `:::name` is not a known directive. The block renders as a plain block with its content kept.

```markdown
:::timeline
…
:::
```

Fix: check the spelling (known directives are `tabs`, `tab`, `cards`, `card`, `steps`, `details`, `columns`, `column`, plus admonitions with the callout names such as `note` and `warning`), or use a callout or plain Markdown instead. Directive syntax is in [[rich-content]].

### empty-link

`[[]]` or `[[ ]]` has no target. It is shown as written and produces no link.

```markdown
A link goes here later [[ ]].
```

Fix: fill in the target, or delete it.

### required-field

The note's type lists a field under `required` in `clio.toml`, and the note's frontmatter does not have it.

```toml
[types.paper]
required = ["summary"]
```

Fix: add the field to the frontmatter. To relax the rule, change `required`; see [[config#types]].

### translation-stale

A translation's `translation-of-hash` differs from the current content hash of its source (the default-language version): the source changed after the translation was made. The warning is reported on the translation file.

```yaml
# notes/concepts/pratt-parser.en.md
translation-of-hash: "9c1e0b7a4d2f"   # the source is now 41d07c3e9a55
```

Fix: carry the source's changes into the translation, then set `translation-of-hash` to the source's new hash. [[cli#clio translate-status]] lists every stale translation with the hash to pin; the `hash` field of `clio show <id> --json` is the same value. The workflow is in [[multilingual]].

### part-of-cycle

`part-of` relations form a cycle, for example A is part of B and B is part of A. `part-of` expresses hierarchy; a cycle leaves breadcrumbs and hierarchical navigation undefined.

```yaml
# notes/topics/parsing.md
rel: { part-of: compilers }
# notes/topics/compilers.md
rel: { part-of: parsing }
```

Fix: remove one `part-of` on the cycle, or turn it into `see-also`.

### query

A `clio-query` block cannot be parsed. The page shows the error where the block would be; the rest renders normally.

````markdown
```clio-query
type = concept SORT updated DSC
```
````

`DSC` is not a keyword, so the check reports ``query 1: unexpected `DSC` `` (`1` is the first query block in the note). Fix: correct the syntax (here `DESC`); the syntax is in [[queries]]. Messages say what was expected, for example ``expected a value after `type`, found end of query``.

## Notices

Notices are shown only with `clio check --all`.

### orphan

No other note links here. The home page (id `index` or `home`) is exempt. Appearing in a query result does not count as a link.

Fix: link the note from a related topic or concept note, or give it a `part-of` relation to the topic it belongs to. If the note is no longer needed, set `status: archived` or delete it.

### empty-note

The note has no text besides its frontmatter, usually because it was created with `clio new` and not written yet.

Fix: write the body, or delete the note.

### stale

The `reviewed` date (or `updated`, if there is no `reviewed`) is more than `stale_days` (default 180) days old. Notes with neither field are not checked.

```yaml
updated: 2025-01-04
```

Fix: review the content and, once it is right, set `reviewed` to today. To change the period, set `stale_days` in `clio.toml`.

### translation-missing

The vault has several languages and this note lacks one of them. Reported on the default-language file, once per missing language.

Fix: create the translation (`clio new <type> <title> --lang en`, or write `<id>.en.md` directly), or accept the gap: that language's page shows the default-language version, marked as a fallback.

### translation-unpinned

A translation has no `translation-of-hash`, so there is no way to tell whether it is stale.

Fix: add the hash given in the message to the translation's frontmatter, e.g. `translation-of-hash: "41d07c3e9a55"`.

### callout-type

`> [!type]` uses a type name outside the known list. It still renders as a callout, with the default style.

```markdown
> [!recipe] Method
```

Fix: if it is a typo, use a known type (`note`, `tip`, `warning` and so on; the full list is in [[rich-content]]). If the custom type is intentional, ignore the notice and give it a style in `theme/theme.css`.
