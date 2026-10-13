---
title: Getting started
summary: Install Clio, create a vault, write a first note, check it, build the site and deploy it.
tags: [setup, cli]
rel:
  part-of: index
  see-also: [vault-layout, cli]
updated: 2026-10-13
translation-of-hash: "1a4a4093589f"
---
# Getting started

This page walks through the whole flow once: install Clio, create a vault, preview it in the browser, write a first note, check the links, build the static site and deploy it. Each step covers the common case and links to the details.

## Before you start

You need [Bun](https://bun.sh) 1.2 or later. The Clio CLI is a Bun program. The Rust engine that parses notes ships precompiled to WebAssembly, so neither your machine nor your hosting platform needs Rust.

```bash
bun --version   # 1.2.0 or later
```

If you don't have Bun yet, follow the instructions on bun.sh. On macOS and Linux:

```bash
curl -fsSL https://bun.sh/install | bash
```

## Steps

:::steps
### Install Clio

```bash
bun add -g github:nivalume/Clio
clio --version
```

For now Clio installs straight from GitHub; an npm release is planned.

### Create a vault

```bash
clio new site my-kb
cd my-kb
bun install
```

`clio new site` writes the config, folders, templates, theme, deployment files and the Agent Skill. The default starter is `llm-wiki`, meant for a personal or team knowledge base; use `--starter docs` for a documentation site or `--starter blank` for just the config and a home page. Add `--locales zh,en` for a bilingual vault.

`bun install` installs Clio into the project itself: the generated `package.json` depends on `"clio": "github:nivalume/Clio"`. The project pins its own Clio version, and your hosting platform builds with that version, whatever you have installed globally.

### Look around

```text
my-kb/
  clio.toml        site title, languages, types, relations
  AGENTS.md        conventions for agents (CLAUDE.md is one line: @AGENTS.md)
  index.md         home page
  log.md           operations log, append-only
  raw/             original sources, read-only
  notes/           notes: sources/ concepts/ entities/ topics/ questions/
  templates/       one template per note type
  theme/           theme.css to override colours and fonts
```

The folders under `notes/` set a note's default type; they are not topics. [[vault-layout]] explains every folder and why it is laid out this way.

### Start the preview

```bash
clio dev
```

Open `http://localhost:4321`. `clio dev` builds once, then watches your files: save any note and it rebuilds and reloads the browser. If the port is taken, add `--port 8080`.

### Write your first note

```bash
clio new concept "Vector search" --id vector-search --tags search
```

This creates `notes/concepts/vector-search.md` from `templates/concept.md`. `--id` is the note's id and file name, and it is what links refer to, so keep it short, English and kebab-case. Open the file and change it to:

```markdown title="notes/concepts/vector-search.md"
---
title: Vector search
summary: Find documents by vector similarity instead of keyword matching.
tags: [search]
status: seed
created: 2026-10-13
updated: 2026-10-13
---
# Vector search

Encode the query and the documents as vectors and rank by cosine similarity.
It complements [[bm25]]: BM25 is good at exact terms, vectors at paraphrases.

It [[depends-on::embedding]].
```

`[[bm25]]` is a plain link. `[[depends-on::embedding]]` is a typed link that says how the two notes relate; the `embedding` page will show "used by ← Vector search" on its own. Neither target exists yet, which is fine, as the next step shows. [[writing-notes]] explains the fields and [[linking]] the link syntax.

### Check

```text
$ clio check
notes/concepts/vector-search.md
  12   warning wanted                link to missing note `bm25`
  14   warning wanted                link to missing note `embedding`

2 notes · 2 files · 2 links · 2 wanted · 0 errors · 2 warnings · 1 notices
```

Each line shows the line number, level, lint code and message. `wanted` means a link points to a note that doesn't exist yet. It is a warning, not an error: writing the link first and the note later is the normal way to work. Wanted notes appear in the site's "not written yet" list and as ghost nodes in the graph.

Only errors, such as frontmatter that isn't valid YAML, make `clio check` exit with code 1. Add `--all` to also see notices, such as orphan notes that nothing links to. [[lint-codes]] lists every code.

### Build

```bash
clio build
clio serve
```

`clio build` writes the site to `.clio/site`: one static HTML page per note, plus the front-end app, the search index and an `llms.txt` for language models. `clio serve` serves that folder locally so you can check what you are about to deploy.

### Deploy

Push the project to GitHub and import the repository in Vercel. The project already has a `vercel.json`, so there is nothing to configure, and every push deploys. [[deploy]] covers GitHub Pages and other static hosts.
:::

## Next

- [[writing-notes]]: frontmatter fields, types, status and templates.
- [[linking]]: typed relations, backlinks and wanted notes.
- [[agents]]: let an agent ingest sources, answer questions and maintain the vault, following the LLM Wiki pattern.
- [[cli]]: every command and option.
