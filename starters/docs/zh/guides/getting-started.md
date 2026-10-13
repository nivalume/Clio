---
title: 快速开始
summary: 安装依赖、本地预览、写第一页，再部署上线。
tags: [start]
rel:
  part-of: index
updated: __DATE__
---
# 快速开始

读完这一页，你会在本地看到这个文档站，并写出自己的第一页。

:::steps
### 安装

需要 Bun 1.2 或更高版本。

```bash
bun install
```

### 本地预览

```bash
bunx clio dev
```

打开 `http://localhost:4321`。之后每次保存文件，页面都会自动刷新。

### 写一页

```bash
bunx clio new guide "部署" --id deploy
```

新页面在 `guides/deploy.md`。在其他页面里用 `[[deploy]]` 链接它。

### 检查并部署

```bash
bunx clio check
```

没有错误后推到 GitHub。项目里已经有 `vercel.json` 和 GitHub Pages 工作流，选一个即可。
:::

可调的选项见 [[configuration]]，整体结构见 [[overview]]。
