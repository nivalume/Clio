---
title: 部署
summary: clio build 的输出结构，以及部署到 Vercel、GitHub Pages 和任意静态托管的步骤。
tags: [deploy, build]
rel:
  part-of: index
  see-also: [config, customizing]
updated: 2026-10-13
---
# 部署

`clio build` 生成的是纯静态文件：HTML、JavaScript、CSS、JSON 和搜索索引，不需要服务器或数据库。任何能托管静态文件的地方都能放。本页先说明输出目录里有什么，再分别介绍 Vercel、GitHub Pages 和其他静态托管。

## 构建

```bash
clio build                   # 输出到 .clio/site
clio build --out dist        # 换一个输出目录
clio build --base /kb/       # 网站不在域名根路径时
clio serve                   # 在本地检查构建结果
```

构建前先跑一次 `clio check`。它在有错误时以退出码 1 结束，放在部署流程里可以挡住坏掉的版本。

部署配置里用 `bun run check` 和 `bun run build`，也就是 `package.json` 里的脚本，而不是 `bunx clio …`。原因是 npm 上有一个无关的同名包 `clio`：在没有安装 Clio 的环境里，`bunx clio` 会下载并运行那个包。`bun run` 只运行项目自己的脚本，用的一定是 `bun install` 装进项目的 Clio。

## 输出目录

一个中英双语知识库的输出：

```text
.clio/site/
  index.html          根页面：按浏览器语言跳到 /zh/ 或 /en/
  404.html            找不到页面时显示
  .nojekyll           让 GitHub Pages 原样发布以 _ 开头的目录
  zh/
    index.html        首页
    n/<id>.html       每篇笔记一个页面
    n/<id>.md         这篇笔记的 Markdown 原文
    graph.html  explore.html  tags.html  health.html  wanted.html
    tags/<tag>.html   每个标签一个页面，嵌套标签的上级也有
  en/
    …                 结构同 zh/
  _app/               前端应用：搜索、图谱、反向链接面板
  _assets/            笔记里引用的图片
  _clio/<lang>/*.json 前端按需加载的数据：站点清单、图谱、检查结果
  pagefind/           Pagefind 搜索索引
  llms.txt            给语言模型的站点目录
  sitemap.xml         设置了 [site] url 时生成
  robots.txt          设置了 [site] url 时生成
```

单语言站点没有 `zh/`、`en/` 这一层，笔记直接在 `n/<id>.html`。

几个设计上的考虑：

- **每个页面不依赖 JavaScript 也能读。** `n/<id>.html` 里是完整渲染好的正文、关系和反向链接。搜索引擎、不执行脚本的浏览器和抓取网页的 Agent 都能直接读。前端应用加载后再补上搜索、图谱和交互。
- **数据按需加载。** `_clio/` 里的数据按页面拆开，打开一个页面只取它需要的部分，所以几万篇笔记的网站打开速度也不受影响。
- **搜索在浏览器里完成。** Pagefind 在构建时建立索引（中文有分词），浏览器只下载查询用到的索引分片，不需要搜索服务器。
- **给 Agent 的入口。** `llms.txt` 是给语言模型的站点目录，列出每篇笔记的标题、摘要和 `.md` 原文的地址。Agent 读原文比读 HTML 省得多。

## Vercel

`clio new site` 生成的项目已经带有 `vercel.json` 和 `package.json`。用 `clio init` 建的库没有这两个文件，从下面复制：

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

| 键 | 作用 |
|---|---|
| `framework` | `null`：不让 Vercel 猜测框架，按下面几项执行 |
| `installCommand` | 用 Bun 安装依赖，包括 `package.json` 里固定版本的 clio |
| `buildCommand` | 先检查，有错误时构建失败、线上版本不变；再用项目里安装的 clio 构建 |
| `outputDirectory` | 发布的目录 |
| `cleanUrls` | 让 `/zh/n/bm25` 直接对应 `zh/n/bm25.html`，网址里不出现 `.html` |

部署步骤：

:::steps
1. 把项目推到 GitHub（或 GitLab、Bitbucket）。
2. 在 Vercel 新建项目，导入这个仓库。`vercel.json` 已经包含全部设置，直接部署。
3. 之后每次推送到主分支都会自动部署；拉取请求会得到一个预览网址。
:::

Vercel 的构建环境自带 Bun，不需要额外配置。引擎是随包发布的 WebAssembly，构建机上也不需要 Rust。

## GitHub Pages

`clio new site` 生成了 `.github/workflows/pages.yml`。项目里没有时，用下面这份（还需要上一节的 `package.json`）：

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

`actions/configure-pages` 给出网站在域名下的路径 `base_path`：项目站点（`https://<用户名>.github.io/<仓库名>/`）是 `/<仓库名>`，用户站点（仓库名是 `<用户名>.github.io`）和绑定了自定义域名的站点是空字符串。工作流把它作为 `--base` 传给构建，所以不需要在 `clio.toml` 里改 `base`。

然后在仓库的 Settings → Pages 里，把 Source 设为 GitHub Actions。之后每次推送到 `main` 都会检查、构建并发布；检查有错误时工作流失败，线上版本保持不变。

## 其他静态托管

Netlify、Cloudflare Pages 等平台的设置都一样：

| 设置 | 值 |
|---|---|
| 安装命令 | `bun install` |
| 构建命令 | `bun run check && bun run build` |
| 发布目录 | `.clio/site` |

网站不在域名根路径时（例如 `https://example.com/kb/`），在 `clio.toml` 里写 `base = "/kb/"`，或者把构建命令改成 `bun run check && bun run build --base /kb/`。

服务器要能把 `/zh/n/bm25` 对应到 `zh/n/bm25.html`，找不到页面时返回 `404.html`。上面这些平台默认就这样处理。自己用 nginx 托管时：

```nginx
location / {
  try_files $uri $uri.html $uri/ =404;
}
error_page 404 /404.html;
```

也可以在本机构建后，把 `.clio/site` 整个上传到任何文件服务器或对象存储。

## 上线前检查

- `clio check` 没有错误。
- `base` 和实际的网址路径一致：页面能打开但样式丢失，通常是 `base` 不对。
- 想要每页的「编辑此页」链接，在 `clio.toml` 的 `[site]` 里设置 `repo`，见 [[customizing#编辑此页]]。
- 想要 `sitemap.xml` 和规范链接，在 `[site]` 里设置 `url`，见 [[config#site]]。
- `.clio/` 不要提交到 git，构建平台会自己生成。
