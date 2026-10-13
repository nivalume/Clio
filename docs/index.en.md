---
title: Clio
summary: A knowledge base for the agent era — Markdown with typed links, a Rust engine that builds a static site, maintained by people and agents together.
tags: [overview]
rel:
  see-also: [getting-started, architecture]
updated: 2026-10-13
translation-of-hash: "5db6959dfc05"
---
# Clio

Clio is a knowledge-base system that people and AI agents maintain together. You write notes in Markdown with a few extensions. A Rust engine (compiled to WebAssembly and run by Bun) parses them, resolves links, builds a knowledge graph and writes a static website with full-text search, a graph view, typed backlinks and a bilingual interface. Agents work on the same vault through a CLI with `--json` output and an Agent Skill. This handbook is itself a Clio vault.

## Three ideas

**Typed links form a knowledge graph.** `[[id]]` links to another note; `[[depends-on::id]]` also says how the two are related. Every relation has a declared inverse, so the target page shows "used by ← A, B" automatically. A link to a note that does not exist yet is not an error: it becomes a wanted note and a ghost node in the graph. See [[linking]] and [[knowledge-graph]].

**A Rust engine writes a static site that scales to tens of thousands of notes.** The engine parses each note once, then resolves links, computes PageRank and clusters, lints and indexes the whole vault. The output is plain static files that you can put on GitHub Pages, Vercel or any static host; there is no server. See [[architecture]] and [[performance]].

**Agents maintain the vault through the CLI and a skill.** `clio search`, `clio context` and `clio check` all print JSON. The bundled Agent Skill follows Andrej Karpathy's "LLM Wiki" pattern: raw sources are read-only, the agent maintains the notes, `AGENTS.md` holds the conventions and `log.md` records every operation. See [[agents]] and [[information-architecture]].

## Quick start

You need Bun 1.2 or later.

```bash
bun add -g github:nivalume/Clio
clio new site my-kb
clio dev --dir my-kb
```

Open `http://localhost:4321`. Continue with [[getting-started]].

## Guides

```clio-query
type = guide
SORT title
SHOW cards
```

## Reference

```clio-query
type = reference
SORT title
```

## Concepts

```clio-query
type = concept
SORT title
```
