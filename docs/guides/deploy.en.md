---
title: Deploying
summary: What clio build writes, and how to deploy it to Vercel, GitHub Pages or any static host.
tags: [deploy, build]
rel:
  part-of: index
  see-also: [config, customizing]
updated: 2026-10-13
translation-of-hash: "760efa952115"
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

Deployment configs use `bun run check` and `bun run build`, the scripts in `package.json`, rather than `bunx clio …`. The reason is that the npm registry has an unrelated package named `clio`: where Clio is not installed, `bunx clio` downloads and runs that package. `bun run` only runs the project's own scripts, so it always uses the Clio that `bun install` put in the project.

## Output

The output of a vault in Chinese and English:

```text
.clio/site/
  index.html          root page: sends readers to /zh/ or /en/ by browser language
  404.html            shown when a page is not found
  .nojekyll           makes GitHub Pages publish folders starting with _ as they are
  zh/
    index.html        home page
    n/<id>.html       one page per note
    n/<id>.md         the note's Markdown source
    graph.html  explore.html  tags.html  health.html  wanted.html
    tags/<tag>.html   one page per tag, including parents of nested tags
  en/
    …                 same structure as zh/
  _app/               the front-end app: search, graph, backlink panels
  _assets/            images referenced by notes
  _clio/<lang>/*.json data the app loads on demand: site manifest, graph, lint results
  pagefind/           the Pagefind search index
  llms.txt            a site index for language models
  sitemap.xml         written when [site] url is set
  robots.txt          written when [site] url is set
```

A single-language site has no `zh/` or `en/` level; notes are at `n/<id>.html`.

Some design decisions behind this:

- **Every page reads without JavaScript.** `n/<id>.html` contains the fully rendered body, relations and backlinks. Search engines, browsers without scripts and agents that fetch pages can read it as is. The front-end app adds search, the graph and interaction once it loads.
- **Data loads on demand.** The data in `_clio/` is split by page, and opening a page fetches only what it needs, so a site with tens of thousands of notes opens just as fast.
- **Search runs in the browser.** Pagefind builds the index at build time (with Chinese word segmentation), and the browser downloads only the index fragments a query needs; there is no search server.
- **An entry point for agents.** `llms.txt` is a site index for language models listing each note's title, summary and the address of its `.md` source. Reading the source costs an agent far less than reading HTML.

## Vercel

Projects created by `clio new site` already contain a `vercel.json` and a `package.json`. A vault set up with `clio init` has neither; copy them from here:

```json title="vercel.json"
{
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bun run check && bun run build",
  "outputDirectory": ".clio/site",
  "cleanUrls": true
}
```

```json title="package.json"
{
  "name": "my-kb",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "clio dev",
    "build": "clio build",
    "check": "clio check",
    "serve": "clio serve"
  },
  "dependencies": {
    "clio": "github:nivalume/Clio#v0.1.0"
  }
}
```

| Key | Purpose |
|---|---|
| `framework` | `null`: Vercel doesn't guess a framework and runs the commands below |
| `installCommand` | Installs dependencies with Bun, including the clio version pinned in `package.json` |
| `buildCommand` | Checks first, so errors fail the build and the live site stays as it was; then builds with the clio installed in the project |
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

`clio new site` writes `.github/workflows/pages.yml`. If your project doesn't have it, use this one (it also needs the `package.json` from the previous section):

```yaml title=".github/workflows/pages.yml"
# Builds the site and publishes it to GitHub Pages on every push to main.
# Enable it once: repository Settings → Pages → Source: GitHub Actions.
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
      - id: pages
        uses: actions/configure-pages@v5
      - run: bun install
      - run: bun run check
      # A project site lives under /<repository>/; base_path is empty for user sites and custom domains.
      - run: bun run build --base "${{ steps.pages.outputs.base_path }}/"
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

`actions/configure-pages` provides the site's path on its domain as `base_path`: `/<repo>` for a project site (`https://<user>.github.io/<repo>/`), and an empty string for a user site (a repository named `<user>.github.io`) or a custom domain. The workflow passes it to the build as `--base`, so `base` in `clio.toml` needs no change.

Then, under the repository's Settings → Pages, set Source to GitHub Actions. Every push to `main` now checks, builds and publishes; if the check finds errors the workflow fails and the live site stays as it was.

## Other static hosts

Netlify, Cloudflare Pages and similar platforms all take the same settings:

| Setting | Value |
|---|---|
| Install command | `bun install` |
| Build command | `bun run check && bun run build` |
| Publish directory | `.clio/site` |

If the site isn't at the domain root (for example `https://example.com/kb/`), set `base = "/kb/"` in `clio.toml`, or change the build command to `bun run check && bun run build --base /kb/`.

The server has to map `/zh/n/bm25` to `zh/n/bm25.html` and return `404.html` for pages that don't exist. The platforms above do that by default. With your own nginx:

```nginx
location / {
  try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

You can also build locally and upload `.clio/site` as a whole to any file server or object storage.

## Before going live

- `clio check` reports no errors.
- `base` matches the real URL path: pages that load without their styles usually mean a wrong `base`.
- For "edit this page" links on every page, set `repo` under `[site]` in `clio.toml`; see [[customizing#Edit this page]].
- For `sitemap.xml` and canonical links, set `url` under `[site]`; see [[config#site]].
- Don't commit `.clio/`; the build platform generates it.
