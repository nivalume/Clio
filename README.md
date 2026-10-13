# Clio

[English](README.en.md) · 手册：<https://clio-one.vercel.app>

面向 Agent 时代的知识库。用带扩展语法的 Markdown 写笔记；Rust 引擎（编译成 WebAssembly，由 Bun 运行）解析笔记、解析链接、建立知识图谱，生成一个静态网站；人和 AI Agent 通过命令行和 Agent Skill 一起维护同一个知识库。

- **带类型的链接。** `[[id]]` 兼容 Obsidian 写法，按稳定的 id、别名或标题解析，改名和移动文件不断链。`[[depends-on::id]]` 写出关系，目标页面自动显示反向关系（被依赖、包含、被引用……）。链接到不存在的笔记会成为“待写”节点。
- **丰富的内容。** 提示块、标签页、卡片、步骤、Shiki 代码高亮、KaTeX 公式、Mermaid、图表，以及构建时求值的查询块（类似 Dataview）。
- **为大规模设计。** 引擎每篇笔记只解析一次，再在全库上解析链接、计算 PageRank 和 Louvain 聚类、做检查和 BM25 索引。网站是纯静态文件，数据按需加载，搜索用 Pagefind。
- **给 Agent 用。** 所有只读命令都有 `--json`；`clio context` 把一篇笔记和它的邻居整理成一段 Markdown；`clio mcp` 提供 MCP 服务；附带的 Skill 按 Karpathy 的 LLM Wiki 模式工作（收录、提问、检查、翻译）。
- **双语。** `x.md` 和 `x.en.md` 是同一篇笔记的两种语言，界面可切换，`translation-of-hash` 跟踪过期译文。

## 开始

需要 [Bun](https://bun.sh) 1.2 或更高版本。不需要 Rust：引擎以 `.wasm` 随包发布。

```bash
bun add -g github:nivalume/Clio#v0.1.0
clio new site my-kb            # 起步模板：llm-wiki（默认）、docs、blank
cd my-kb && bun install
bun run dev                    # http://localhost:4321
```

生成的项目带有 `AGENTS.md`、Agent Skill（`skills/clio`，并链接到 `.claude/skills` 和 `.agents/skills`）、`vercel.json` 和 GitHub Pages 工作流。

## 命令

| 命令 | 作用 |
|---|---|
| `clio new site <dir>` | 新建项目（类似 `hugo new site`） |
| `clio init [--adopt]` | 在已有目录里建立知识库；`--adopt` 用于 Obsidian 库 |
| `clio new <type> <title>` | 按模板新建笔记 |
| `clio ingest <file\|url>` | 收录原始资料：复制到 `raw/`、记录 sha256、生成来源笔记草稿、写日志 |
| `clio check` | 检查链接、锚点、frontmatter、原始资料和译文 |
| `clio search` · `show` · `backlinks` · `context` · `resolve` · `stats` | 查询知识库 |
| `clio mv <old> <new>` | 改 id，并改写所有指向它的链接 |
| `clio log <op> <title>` | 往 `log.md` 追加一条记录 |
| `clio translate-status [--pin id]` | 缺失和过期的译文 |
| `clio build` · `dev` · `serve` | 生成、预览静态网站 |
| `clio mcp` | 在 stdio 上运行 MCP 服务 |

完整说明见手册的[命令行参考](https://clio-one.vercel.app/zh/n/cli)。

## 仓库结构

```text
crates/clio-core     Rust 引擎：语法、渲染、链接解析、图算法、检查、查询、搜索
crates/clio-wasm     编译成 wasm32 的引擎（packages/clio/engine/clio.wasm 已提交）
crates/clio-native   原生二进制，用于测试和基准
packages/clio        命令行（Bun + TypeScript）和网站构建
packages/web         前端（React + Vite），构建结果提交在 packages/clio/web
skills/clio          Agent Skill
starters/            clio new site 的起步模板
docs/                Clio 自己的手册，也是一个 Clio 知识库
```

开发：

```bash
bun install
cargo test --workspace
bun test
bun run typecheck
bun run build:wasm      # 改了 crates/ 之后
bun run build:web       # 改了 packages/web/ 之后
bun run check:fresh     # 确认提交的 .wasm 和前端与源码一致
bun run build:docs && bun packages/clio/bin/clio.ts serve --dir docs
```

## 许可证

MIT
