---
title: Getting started
summary: Install, preview locally, write the first page, then deploy.
tags: [start]
rel:
  part-of: index
updated: __DATE__
---
# Getting started

After this page you will have the docs running locally and your first page written.

:::steps
### Install

You need Bun 1.2 or later.

```bash
bun install
```

### Preview

```bash
bunx clio dev
```

Open `http://localhost:4321`. Every time you save a file the page reloads.

### Write a page

```bash
bunx clio new guide "Deploying" --id deploy
```

The new page is `guides/deploy.md`. Link to it from other pages with `[[deploy]]`.

### Check and deploy

```bash
bunx clio check
```

When there are no errors, push to GitHub. The project already has a `vercel.json` and a GitHub Pages workflow; use either.
:::

Options are in [[configuration]]; the overall structure is in [[overview]].
