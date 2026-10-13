---
title: Clio
summary: 面向 Agent 时代的知识库：带类型链接的 Markdown，Rust 引擎生成静态网站，人和 Agent 共同维护。
tags: [overview]
rel:
  see-also: [getting-started, architecture]
updated: 2026-10-13
---
# Clio

Clio 是一个由人和 AI Agent 共同维护的知识库系统。你用带扩展语法的 Markdown 写笔记；Rust 引擎（编译成 WebAssembly，由 Bun 运行）解析笔记、解析链接、构建知识图谱，再生成一个静态网站，带全文搜索、图谱视图、带类型的反向链接和双语界面。Agent 通过带 `--json` 输出的命令行和一个 Agent Skill 维护同一个知识库。这本手册本身就是一个 Clio 知识库。

## 三个想法

**带类型的链接构成知识图谱。** `[[id]]` 链接到另一篇笔记，`[[depends-on::id]]` 还说明两篇笔记是什么关系。每种关系有声明好的反向名称，目标页面上自动显示「被依赖 ← A, B」。链接到还不存在的笔记不算错误，它会成为一个待写笔记，在图谱里显示为幽灵节点。详见 [[linking]] 和 [[knowledge-graph]]。

**Rust 引擎生成静态网站，能撑到几万篇笔记。** 引擎每篇笔记只解析一次，之后在整个知识库上解析链接、计算 PageRank 和聚类、做检查和索引。输出是纯静态文件，放在 GitHub Pages、Vercel 或任何静态托管上即可，不需要服务器。详见 [[architecture]] 和 [[performance]]。

**Agent 通过命令行和 Skill 维护知识库。** `clio search`、`clio context`、`clio check` 都能输出 JSON；附带的 Agent Skill 按 Andrej Karpathy 的「LLM Wiki」模式工作：原始资料只读，Agent 维护笔记，`AGENTS.md` 规定约定，`log.md` 记录每次操作。详见 [[agents]] 和 [[information-architecture]]。

## 快速开始

需要 Bun 1.2 或更高版本。

```bash
bun add -g github:nivalume/Clio#v0.1.0
clio new site my-kb
cd my-kb && bun install && bun run dev
```

浏览器打开 `http://localhost:4321`。下一步读 [[getting-started]]。

## 指南

```clio-query
type = guide
SORT title
SHOW cards
```

## 参考

```clio-query
type = reference
SORT title
```

## 概念

```clio-query
type = concept
SORT title
```
