---
title: Overview
summary: What these docs are made of and what happens when they are built.
tags: [overview]
rel:
  part-of: index
  see-also: [getting-started]
updated: __DATE__
---
# Overview

```mermaid
flowchart LR
  md[Markdown pages] --> clio[clio build]
  clio --> site[static site]
  site --> host[Vercel / GitHub Pages]
```

- Each Markdown file is a page; its file name is the page id.
- Pages link with `[[id]]`; a linked page lists what links to it.
- `clio build` writes plain static files to `.clio/site`, which any static host can serve.
