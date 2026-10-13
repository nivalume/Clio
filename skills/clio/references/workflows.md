# Workflows in detail

## Ingest

```text
$ clio ingest ~/Downloads/attention.pdf --title "Attention Is All You Need"
raw/attention-is-all-you-need.pdf  sha256 3f2a9c…e81b
created notes/sources/attention-is-all-you-need.md (draft)
log.md  ## [2026-10-13] ingest | Attention Is All You Need
```

URLs are downloaded as they are (HTML stays HTML). If the person gives you text instead of a file, save it under
`raw/` first, then ingest that file.

The source note after you fill it in:

```markdown
---
title: Attention Is All You Need
type: source
status: stable
raw: raw/attention-is-all-you-need.pdf
sha256: 3f2a9c…e81b
summary: Introduces the Transformer, a sequence model built only from attention, faster to train than RNNs.
tags: [ml/transformers]
---
# Attention Is All You Need

Vaswani et al., 2017.

## Claims

- Self-attention relates every position to every other in one step, so paths between tokens have constant length. ^claim-1
- The Transformer reached 28.4 BLEU on WMT 2014 English–German. ^claim-2
```

Then update the notes it touches, for example in `notes/concepts/self-attention.md`:

```markdown
Self-attention connects any two positions in one step [[attention-is-all-you-need^claim-1]].
```

Finally list the changes under the log entry:

```markdown
## [2026-10-13] ingest | Attention Is All You Need
- created: attention-is-all-you-need, self-attention, positional-encoding
- updated: transformer, sequence-models (topic), rnn
```

## Reading command output

`clio search "<q>" --json` returns `[{ id, title, type, path, url, score, snippet }]`, best first.

`clio context <id> --hops N` prints Markdown: the note's full source, its direct relations with the other note's
summary, notes within N hops, and wanted links. It is meant to be pasted into your context as is.

`clio check --json` returns `{ summary: { notes, errors, warnings, infos, … }, diags: [{ path, level, line, code, message }] }`.
Codes:

| level | codes |
|---|---|
| error | `frontmatter` (bad YAML), `duplicate-id`, `raw-modified` |
| warning | `wanted`, `missing-anchor`, `ambiguous-link`, `unknown-relation`, `unknown-directive`, `empty-link`, `required-field`, `translation-stale`, `part-of-cycle`, `query` |
| notice (`--all`) | `orphan`, `empty-note`, `stale`, `translation-missing`, `translation-unpinned`, `callout-type` |

`clio translate-status --json` returns `[{ id, source, lang, status, path, hash, translationOfHash }]` with status
`missing`, `unpinned` or `stale`.

## Filing an answer back

```text
$ clio new question "Pratt parsing or recursive descent?" --id pratt-vs-recursive-descent
created notes/questions/pratt-vs-recursive-descent.md
```

Write the answer with links to the notes it rests on, add `rel: { part-of: <topic> }`, and link it from that topic
note so it is not an orphan.

## Renaming

`clio mv old-id new-id` renames the file (and its translations) and rewrites `[[old-id…]]`, `rel:` entries and
Markdown links in every note. Links written with an alias or title keep working without changes.

## Hand-off

End every task with a short report: what changed (notes created / updated), what `clio check` says, and open
questions for the person (contradictions you could not resolve, wanted notes you did not write).
