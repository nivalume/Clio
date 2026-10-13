---
title: 路线图
summary: v1 已经有什么，之后计划做什么，以及每一项为什么还没做。
tags: [roadmap]
rel:
  part-of: index
  see-also: [architecture]
updated: 2026-10-13
---
# 路线图

这一页列出 Clio v1 已经具备的功能和之后的计划。计划项没有日期，顺序大致是优先级。想参与或提建议，在 [GitHub 仓库](https://github.com/nivalume/Clio) 开 issue。

## v1 已有

- [x] Clio Markdown：CommonMark、GFM、wikilink、类型关系、嵌入、块 id、标签、callout、指令、代码高亮、公式、Mermaid、图表、查询块，见 [[syntax-cheatsheet]]
- [x] Rust 引擎，编译成约 1.5 MB 的 WebAssembly，由 Bun 加载，用户不需要安装 Rust
- [x] 原生构建与 WebAssembly 构建的输出逐字节相同，并有测试保证
- [x] 链接解析（id → 别名 → 标题 → 路径）、反向标签、幽灵节点
- [x] PageRank、Louvain 聚类和聚类自动命名，见 [[knowledge-graph]]
- [x] 19 个检查码，见 [[lint-codes]]
- [x] BM25 命令行搜索（中英文）和 Pagefind 网站搜索
- [x] 中英双语：译文文件、按语言的 URL、`translation-of-hash` 过期检测
- [x] 命令行：`new site`、`init --adopt`、`new`、`ingest`、`build`、`dev`、`serve`、`check`、`show`、`backlinks`、`search`、`context`、`resolve`、`stats`、`mv`、`log`、`translate-status`、`mcp`，见 [[cli]]
- [x] 读命令的 `--json` 输出，MCP 服务
- [x] 按 Karpathy「LLM Wiki」模式工作的 Agent Skill，见 [[agents]]
- [x] 静态网站：搜索优先的首页、分面浏览、笔记页、全局图谱、标签、健康页，浅色和深色主题
- [x] `theme.css` 主题变量和 `clio.config.ts` 渲染插件
- [x] 部署到 GitHub Pages 和 Vercel 的配置文件，见 [[deploy]]

## 计划

### 发布与安装

- [ ] **发布到 npm。** 现在从 GitHub 安装（`bun add -g github:nivalume/Clio#v0.1.0`）。npm 上的 `clio` 这个名字已经被一个无关的包占用，所以会用带作用域的名字（例如 `@nivalume/clio`）发布，之后可以按普通的版本号安装和升级。
- [ ] **预编译的原生二进制。** WebAssembly 版本已经够快，原生版本目前只用于测试和基准测试。对很大的知识库，按平台提供预编译的原生引擎可以进一步缩短构建时间，见 [[performance]]。

### 收录

- [ ] **`clio ingest` 把网页转换成 Markdown。** 现在 URL 按原样下载保存，Agent 需要自己读 HTML。计划在保存原文的同时生成一份干净的 Markdown 版本，原文仍然保留在 `raw/` 里，哈希仍然针对原文。

### 语法

- [ ] **行内指令。** 现在指令只有块级形式（`:::name`）。计划加入行内形式，例如 `:kbd[Ctrl+K]`、`:badge[beta]`。
- [ ] **原始 HTML 白名单。** 现在原始 HTML 一律丢弃，因为笔记可能来自网页。计划允许在 `clio.toml` 里列出一小组安全的标签（如 `<kbd>`、`<sub>`、`<sup>`），其余仍然丢弃。

### 图

- [ ] **Leiden 聚类。** Louvain 可能产生内部不连通的社区；Leiden 算法在 Louvain 的基础上加了一步细化，保证每个社区内部连通，结果通常更稳定。要保留确定性，所以需要一个不依赖随机数的实现。
- [ ] **超过 5 万个节点时用 WebGL 画图谱。** 现在的图谱视图用 d3 的力导向布局，在浏览器里逐个绘制节点和边。节点超过约 5 万个时，绘制本身成为瓶颈，需要改用 WebGL。

### 网站

- [ ] **水合（hydration）。** 现在静态 HTML 和 React 应用是两套：先显示静态页面，再由应用接管渲染。计划让应用直接在静态 HTML 上水合，减少首屏的闪动和重复工作。

### 编辑

- [ ] **编辑器集成。** 在 VS Code 等编辑器里提供 `[[` 补全、链接跳转、悬停预览和检查结果的即时提示，基于同一个引擎（例如通过语言服务器协议）。

## 不打算做的

- **服务器端。** 网站保持纯静态，原因见 [[architecture#为什么是静态网站]]。
- **数据库。** Markdown 文件就是数据，版本库就是历史。
- **账号和权限。** 访问控制交给托管平台和版本库。
