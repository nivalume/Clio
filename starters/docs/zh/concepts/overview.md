---
title: 结构概览
summary: 这个文档站由哪些部分组成，构建时发生了什么。
tags: [overview]
rel:
  part-of: index
  see-also: [getting-started]
updated: __DATE__
---
# 结构概览

```mermaid
flowchart LR
  md[Markdown 页面] --> clio[clio build]
  clio --> site[静态网站]
  site --> host[Vercel / GitHub Pages]
```

- 每个 Markdown 文件是一页，文件名就是页面 id。
- 页面之间用 `[[id]]` 链接；被链接的页面会自动显示“链接到这里”。
- `clio build` 生成纯静态文件，放在 `.clio/site`，任何静态托管都能部署。
