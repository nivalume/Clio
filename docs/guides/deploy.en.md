---
title: Deploying
summary: What clio build writes, and how to deploy it to Vercel, GitHub Pages or any static host.
tags: [deploy, build]
rel:
  part-of: index
  see-also: [config, customizing]
updated: 2026-10-13
translation-of-hash: "123fdb94a802"
---
# Deploying

`clio build` writes plain static files: HTML, JavaScript, CSS, JSON and a search index. There is no server and no database, so anything that hosts static files can serve the site. This page first describes the output, then covers Vercel, GitHub Pages and other static hosts.

## Build

```bash
clio build                   # output in .clio/site
clio build --out dist        # a different output folder
clio build --base /kb/       # when the site isn't at the domain root
clio serve                   # check the build locally
```

Run `clio check` before building. It exits with code 1 on errors, so in a deployment pipeline it stops a broken version from going live.

## Output

The output of a vault in Chinese and English:

```text
.clio/site/
  index.html          root page: sends readers to /zh/ or /en/ by browser language
  zh/
    index.html        home page
    n/<id>.html       one page per note
    n/<id>.md         the note's Markdown source
  en/
    index.html
    n/<id>.html
    n/<id>.md
  _app/               the front-end app: search, graph, backlink panels
  _clio/*.json        data the app loads on demand: site manifest, graph, per-page relations
  pagefind/           the Pagefind search index
  llms.txt            a site index for language models
```

A single-language site has no `zh/` or `en/` level; notes are at `n/<id>.html`. Images referenced by notes are copied in as well.

Some design decisions behind this:

- **Every page reads without JavaScript.** `n/<id>.html` contains the fully rendered body, relations and backlinks. Search engines, browsers without scripts and agents that fetch pages can read it as is. The front-end app adds search, the graph and interaction once it loads.
- **Data loads on demand.** The data in `_clio/` is split by page, and opening a page fetches only what it needs, so a site with tens of thousands of notes opens just as fast.
- **Search runs in the browser.** Pagefind builds the index at build time (with Chinese word segmentation), and the browser downloads only the index fragments a query needs; there is no search server.
- **An entry point for agents.** `llms.txt` is a site index for language models listing each note's title, summary and the address of its `.md` source. Reading the source costs an agent far less than reading HTML.

## Vercel

Projects created by `clio new site` already contain a `vercel.json`. If yours doesn't (say the vault was set up with `clio init`), use this one:

```json title="vercel.json"
{
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bunx clio build",
  "outputDirectory": ".clio/site",
  "cleanUrls": true
}
```

| Key | Purpose |
|---|---|
| `framework` | `null`: Vercel doesn't guess a framework and runs the commands below |
| `installCommand` | Installs dependencies with Bun, including the clio version pinned in `package.json` |
| `buildCommand` | Builds with the clio installed in the project |
| `outputDirectory` | The folder to publish |
| `cleanUrls` | Serves `zh/n/bm25.html` at `/zh/n/bm25`, so URLs have no `.html` |

To deploy:

:::steps
1. Push the project to GitHub (or GitLab, or Bitbucket).
2. Create a project in Vercel and import the repository. `vercel.json` has all the settings, so just deploy.
3. From then on, every push to the main branch deploys, and every pull request gets a preview URL.
:::

Vercel's build environment includes Bun, so there is nothing else to set up. The engine ships as WebAssembly inside the package, so the build machine needs no Rust either.

## GitHub Pages

A GitHub Pages project site lives at `https://<user>.github.io/<repo>/`, not at the domain root, so set `base` in `clio.toml`:

```toml
base = "/my-kb/"
```

For a user site (a repository named `<user>.github.io`) or a custom domain, keep `base = "/"`.

`clio new site` writes `.github/workflows/pages.yml`. If your project doesn't have it, use this one:

```yaml title=".github/workflows/pages.yml"
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bunx clio check
      - run: bunx clio build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: .clio/site
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Then, under the repository's Settings → Pages, set Source to GitHub Actions. Every push to `main` now checks, builds and publishes; if `clio check` finds errors the workflow fails and the live site stays as it was.

If you'd rather not change `clio.toml`, write `bunx clio build --base /my-kb/` in the workflow; the command-line option wins.

## Other static hosts

Netlify, Cloudflare Pages and similar platforms all take the same settings:

| Setting | Value |
|---|---|
| Install command | `bun install` |
| Build command | `bunx clio build` |
| Publish directory | `.clio/site` |

The one requirement is that the server maps `/zh/n/bm25` to `zh/n/bm25.html`. The platforms above do that by default. With your own nginx:

```nginx
location / {
  try_files $uri $uri.html $uri/ =404;
}
```

You can also build locally and upload `.clio/site` as a whole to any file server or object storage.

## Before going live

- `clio check` reports no errors.
- `base` matches the real URL path: pages that load without their styles usually mean a wrong `base`.
- For "edit this page" links on every page, set `repo` under `[site]` in `clio.toml`; see [[customizing#Edit this page]].
- Don't commit `.clio/`; the build platform generates it.
