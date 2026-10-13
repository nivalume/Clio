---
title: Configuration
summary: The commonly used keys in clio.toml.
tags: [config]
rel:
  part-of: index
updated: __DATE__
---
# Configuration

Site settings live in `clio.toml` at the project root. The Clio handbook documents every key.

| Key | Default | Meaning |
|---|---|---|
| `title` | folder name | site title |
| `description` | empty | short description for the home page and search engines |
| `base` | `"/"` | URL path of the site, such as `"/docs/"` |
| `locales` | `["zh"]` | languages; the first is the default |
| `stale_days` | `365` | days without an update before a page counts as stale |
| `[site] repo` | none | repository URL, for "edit this page" links |
| `[types.<name>]` | | add a page type |
| `[folders]` | | folder → page type |
