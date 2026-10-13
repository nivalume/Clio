---
title: __TITLE_YAML__
summary: "A knowledge base in Karpathy's LLM Wiki pattern: sources are read-only, notes are maintained by people and agents together."
---
# __TITLE__

This knowledge base follows Andrej Karpathy's "LLM Wiki" pattern:

- `raw/` holds original sources and is read-only;
- `notes/` holds the notes you and your agents maintain: one source note per source, plus concepts, entities, topics and answered questions;
- `AGENTS.md` holds the conventions and `log.md` records every operation.

The starter content is one complete example: the example source [[one-idea-per-card]] was ingested and produced
[[atomic-note]], [[zettelkasten]] and more under the topic [[note-taking]]; the answer to a question was filed back as
[[why-one-idea-per-note]]. Delete them, and the example file in `raw/`, once you have read them.

## Topics

```clio-query
type = topic
SORT title
SHOW cards
```

## Sources

```clio-query
type = source
SORT created DESC, title
LIMIT 20
SHOW table
FIELDS title, summary, created
```

## Questions

```clio-query
type = question
SORT updated DESC, title
```

## Commands

```bash
bunx clio new concept "Title"                    # a note from its template
bunx clio ingest <file or URL> --title "Title"   # add a source
bunx clio search "words"
bunx clio check
bunx clio dev                                    # local preview
```
