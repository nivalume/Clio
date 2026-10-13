---
title: Getting started
summary: Install Clio, create a vault, write a first note, check it, build the site and deploy it.
tags: [setup, cli]
rel:
  part-of: index
  see-also: [vault-layout, cli]
updated: 2026-10-13
translation-of-hash: "ec63dfe53596"
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
bun add -g github:nivalume/Clio#v0.1.0
clio --version
```

For now Clio installs straight from GitHub; `#v0.1.0` pins the version. An npm release is planned.

### Create a vault

```bash
clio new site my-kb --locales en
cd my-kb
bun install
```

`clio new site` writes the config, folders, templates, theme, deployment files, the Agent Skill and a set of example notes. `--locales en` makes English the vault's language; without it the default is Chinese. Use `--locales en,zh` for a bilingual vault. The default starter is `llm-wiki`, meant for a personal or team knowledge base; use `--starter docs` for a documentation site or `--starter blank` for just the config and a home page.

`bun install` installs Clio into the project itself: the generated `package.json` depends on `"clio": "github:nivalume/Clio#v0.1.0"`. The project pins its own Clio version, and your hosting platform builds with that version, whatever you have installed globally.

`package.json` has four scripts, `dev`, `build`, `check` and `serve`; `bun run dev` runs `clio dev` with the project's Clio. `bunx clio …` also works inside the project. Don't use `bunx clio` in a folder where Clio is not installed: the npm registry has an unrelated package named `clio`, and `bunx` would download and run it.

### Look around

```text
my-kb/
  clio.toml        site title, languages, types, relations
  AGENTS.md        conventions for agents (CLAUDE.md is one line: @AGENTS.md)
  index.md         home page
  log.md           operations log, append-only
  raw/             original sources, read-only
  notes/           notes: sources/ concepts/ entities/ topics/ questions/
  journal/         optional daily notes
  templates/       one template per note type
  theme/           theme.css to override colours and fonts
  skills/clio/     the Agent Skill
  package.json     depends on clio; defines the dev, build, check and serve scripts
  vercel.json      Vercel deployment config
```

The folders under `notes/` set a note's default type; they are not topics. [[vault-layout]] explains every folder and why it is laid out this way.

`notes/` and `raw/` already hold an example: one raw source and the source, concept, entity, topic and question notes made from it, with the steps recorded in `log.md`. Read through it to see how a vault fits together, and delete it when you no longer need it.

### Start the preview

```bash
bun run dev
```

Open `http://localhost:4321`. `bun run dev` runs `clio dev`, which builds once, then watches your files: save any note and it rebuilds and reloads the browser. If the port is taken, use `bun run dev --port 8080`.

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
notes/topics/note-taking.md
  18   warning wanted                link to missing note `spaced-repetition`

8 notes · 8 files · 29 links · 3 wanted · 0 errors · 3 warnings · 1 notices
```

Each line shows the line number, level, lint code and message. `wanted` means a link points to a note that doesn't exist yet. It is a warning, not an error: writing the link first and the note later is the normal way to work. The third one comes from the example notes, where `spaced-repetition` is a deliberate wanted link. Wanted notes appear in the site's "not written yet" list and as ghost nodes in the graph.

Only errors, such as frontmatter that isn't valid YAML, make `clio check` exit with code 1. Add `--all` to also see notices, such as orphan notes that nothing links to. [[lint-codes]] lists every code.

### Build

```bash
bun run build
bun run serve
```

`bun run build` runs `clio build`, which writes the site to `.clio/site`: one static HTML page per note, plus the front-end app, the search index and an `llms.txt` for language models. `bun run serve` runs `clio serve`, which serves that folder locally so you can check what you are about to deploy.

### Deploy

Push the project to GitHub and import the repository in Vercel. The project already has a `vercel.json`, which runs `bun run check` and then `bun run build`, so there is nothing to configure, and every push deploys. The project also has a GitHub Pages workflow. [[deploy]] covers GitHub Pages and other static hosts.
:::

## Next

- [[writing-notes]]: frontmatter fields, types, status and templates.
- [[linking]]: typed relations, backlinks and wanted notes.
- [[agents]]: let an agent ingest sources, answer questions and maintain the vault, following the LLM Wiki pattern.
- [[cli]]: every command and option.
