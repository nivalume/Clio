---
title: 命令行
summary: clio 的全部命令：用法、参数、示例输出、退出码，以及 --json 输出的结构。
tags: [cli, reference]
rel:
  part-of: index
  see-also: [getting-started, agents]
updated: 2026-10-13
---
# 命令行

`clio` 是一个 Bun 程序，所有操作都通过它完成：建项目、写笔记、收录资料、检查、构建和预览网站，以及给 Agent 提供 JSON 和 MCP 接口。这一页按用途列出每条命令。入门流程见 [[getting-started]]，Agent 的用法见 [[agents]]。

## 安装

需要 Bun 1.2 或更高版本。

```bash
bun add -g github:nivalume/Clio
clio --version
```

`clio new site` 生成的项目在 `package.json` 里依赖 `"clio": "github:nivalume/Clio"`，所以项目目录里也可以用 `bunx clio …`。npm 发布在 [[roadmap]] 里。

## 用法

```text
clio <command> [arguments] [--dir <vault>] [--json] [--lang <lang>]
```

`clio` 从当前目录（或 `--dir` 指定的目录）向上查找 `clio.toml`，找到的目录就是知识库根目录；找不到时把起点目录当作根目录，使用默认配置。

### 全局参数

| 参数 | 简写 | 作用 |
|---|---|---|
| `--dir <path>` | | 知识库目录，默认是当前目录 |
| `--json` | `-j` | 输出 JSON 而不是给人看的文本；结构见 [[#JSON 输出]] |
| `--lang <lang>` | | 用哪种语言的版本回答（标题、摘要、链接），默认是 `locales` 的第一项 |
| `--help` | `-h` | 列出命令 |
| `--version` | `-v` | 打印版本号 |

参数可以写成 `--limit 5` 或 `--limit=5`。`--` 之后的内容都当作位置参数。

### 环境变量

| 变量 | 作用 |
|---|---|
| `NO_COLOR` | 设置后不输出颜色；输出不是终端时也不着色 |
| `CLIO_TODAY` | 用这个日期（`YYYY-MM-DD`）代替今天，用于 `stale` 检查；让结果可重复 |

### 退出码

| 码 | 含义 |
|---|---|
| `0` | 成功 |
| `1` | `check` 发现错误（加 `--strict` 时警告也算）；`resolve` 没有匹配；参数错误、未知命令、找不到笔记 |

错误信息写到 stderr，正常输出写到 stdout，所以 `clio search 解析 --json | jq` 这样的管道是安全的。

## 命令一览

| 命令 | 作用 |
|---|---|
| [[#clio new site]] | 新建项目：配置、`AGENTS.md`、首页和日志、目录、模板、主题、部署文件、Agent Skill |
| [[#clio init]] | 在当前目录建立知识库；`--adopt` 接管已有的 Obsidian 库 |
| [[#clio new]] | 按模板新建一篇笔记 |
| [[#clio ingest]] | 收录一份原始资料并建立来源笔记草稿 |
| [[#clio log]] | 往 `log.md` 追加一条操作记录 |
| [[#clio build]] | 生成静态网站 |
| [[#clio dev]] | 构建、启动本地服务、文件变化时重建并刷新浏览器 |
| [[#clio serve]] | 只启动服务，提供上一次构建的结果 |
| [[#clio check]] | 检查笔记和链接，有错误时退出码为 1 |
| [[#clio show]] | 一篇笔记的元数据、章节和关系 |
| [[#clio backlinks]] | 哪些笔记指向这一篇 |
| [[#clio search]] | BM25 全文搜索 |
| [[#clio context]] | 一篇笔记及其邻居，整理成给语言模型读的 Markdown |
| [[#clio resolve]] | 一个 id、别名或标题指向哪篇笔记 |
| [[#clio stats]] | 按类型计数、聚类、检查汇总 |
| [[#clio mv]] | 重命名笔记并改写所有指向它的链接 |
| [[#clio translate-status]] | 缺失和过期的翻译 |
| [[#clio mcp]] | 在 stdio 上运行 MCP 服务 |

## 项目

### clio new site

```text
clio new site <dir> [--starter llm-wiki|docs|blank] [--locales zh,en] [--title T]
```

新建一个项目目录，作用类似 `hugo new site`。生成 `clio.toml`、`AGENTS.md`（以及只含 `@AGENTS.md` 的 `CLAUDE.md`）、`index.md`、`log.md`、`raw/`、`notes/` 下的各类型目录、`templates/`、`theme/`、`package.json`、`vercel.json`、GitHub Pages 工作流和 Agent Skill。目录结构见 [[vault-layout]]。

| 参数 | 默认 | 作用 |
|---|---|---|
| `--starter` | `llm-wiki` | `llm-wiki`：按 Karpathy 模式组织的个人知识库；`docs`：文档站，目录为 `guides/ reference/ concepts/`；`blank`：只有配置和首页 |
| `--locales` | `zh` | 语言列表，第一项是默认语言 |
| `--title` | 目录名 | 网站标题，写入 `clio.toml` |

```text
$ clio new site my-kb --locales zh,en --title "我的知识库"
created my-kb/ (starter: llm-wiki)
  clio.toml  AGENTS.md  CLAUDE.md  index.md  log.md
  raw/  notes/{sources,concepts,entities,topics,questions}/  journal/
  templates/ (7)  theme/theme.css
  package.json  vercel.json  .github/workflows/pages.yml
  agent skill: skills/clio/SKILL.md
next: cd my-kb && bun install && clio dev
```

目标目录已存在且不为空时报错退出，不覆盖任何文件。

### clio init

```text
clio init [--adopt]
```

在当前目录（或 `--dir`）建立知识库：写入 `clio.toml`、`AGENTS.md` 和 Agent Skill，已存在的文件不覆盖。

加 `--adopt` 用于已有的 Obsidian 库：不移动任何文件；读取现有的顶层目录，在 `clio.toml` 的 `[folders]` 里写出目录到类型的映射（需要你确认或修改），并安装 Skill。`.obsidian/` 和 `.trash/` 默认被忽略，所以这个库仍然可以继续用 Obsidian 打开。

```text
$ clio init --adopt
found 1,284 notes in 9 folders
wrote clio.toml with [folders]:
  "Papers/" = "source"
  "People/" = "entity"
  "MOCs/"   = "topic"
  (6 folders left as type note; edit clio.toml to map them)
installed agent skill: skills/clio/SKILL.md
run: clio check
```

### clio new

```text
clio new <type> <title> [--id ID] [--tags a,b] [--lang en]
```

用 `templates/<type>.md` 新建一篇笔记，存到该类型对应的目录（由 `[folders]` 决定，见 [[config#folders]]）。模板里可用的变量：`{{title}}`、`{{id}}`、`{{date}}`、`{{lang}}`、`{{type}}`。

| 参数 | 作用 |
|---|---|
| `--id` | 笔记 id，也是文件名；默认由标题生成 |
| `--tags` | 逗号分隔的标签，写入 frontmatter |
| `--lang` | 新建某篇已有笔记的译文 `<id>.<lang>.md`，或指定新笔记的语言 |

```text
$ clio new concept "Pratt 解析器" --id pratt-parser --tags parser,compilers
created notes/concepts/pratt-parser.md
```

id 已被占用时报错退出。

## 资料与日志

### clio ingest

```text
clio ingest <file|url> [--title T]
```

把一份原始资料收录进知识库：复制到 `raw/`（URL 原样下载，不做转换），计算 sha256，在 `notes/sources/` 下建立一篇 `status: draft` 的来源笔记（frontmatter 含 `raw:` 和 `sha256:`），并往 `log.md` 追加一条 `ingest` 记录。之后 `clio check` 会核对 `raw/` 文件是否被改过，见 [[lint-codes#raw-modified]]。

```text
$ clio ingest ~/Downloads/attention.pdf --title "Attention Is All You Need"
raw/attention-is-all-you-need.pdf  sha256 3f2a9c…e81b
created notes/sources/attention-is-all-you-need.md (draft)
log.md  ## [2026-10-13] ingest | Attention Is All You Need
```

### clio log

```text
clio log <op> <title>
```

往 `log.md` 末尾追加一行标题 `## [YYYY-MM-DD] op | title`。`log.md` 只追加，不修改旧记录。常用的 `op` 是 `ingest`、`query`、`lint`、`edit`。

```text
$ clio log query "Pratt 与递归下降的比较"
log.md  ## [2026-10-13] query | Pratt 与递归下降的比较
```

## 构建与预览

### clio build

```text
clio build [--out DIR] [--base /path/]
```

生成静态网站，默认输出到 `.clio/site`。每篇笔记每种语言一个 HTML 页面，加上 React 应用、Pagefind 搜索索引、`llms.txt` 和每篇笔记的 `.md` 镜像。构建过程见 [[architecture]]，部署见 [[deploy]]。

| 参数 | 默认 | 作用 |
|---|---|---|
| `--out` | `.clio/site` | 输出目录 |
| `--base` | `clio.toml` 的 `base` | 网站所在的 URL 路径，例如 GitHub Pages 项目站点用 `/kb/` |

```text
$ clio build --base /kb/
206 notes · 2 languages · 412 pages
search index: 412 pages, 2 languages
built .clio/site in 3.8 s
```

### clio dev

```text
clio dev [--port 4321]
```

构建一次，启动本地服务，监视文件变化：改动后只重新解析变化的笔记，重建网站并刷新浏览器。

```text
$ clio dev
built 206 notes in 3.6 s
serving http://localhost:4321  (watching for changes)
changed notes/concepts/pratt-parser.md → rebuilt in 180 ms
```

### clio serve

```text
clio serve [--port 4321]
```

只提供上一次 `clio build` 的输出，不构建也不监视文件。用来在本地检查准备部署的结果。

```text
$ clio serve --port 8080
serving .clio/site at http://localhost:8080
```

## 检查与查询

下面这些命令只读，都支持 `--json`。

### clio check

```text
clio check [--strict] [--all] [--level error|warning|info] [--json]
```

检查整个知识库：frontmatter、链接、锚点、关系、指令、查询、翻译、原始资料等。每个检查码的含义和修法见 [[lint-codes]]。`clio lint` 是同一个命令。

| 参数 | 作用 |
|---|---|
| `--strict` | 有警告时也以退出码 1 结束 |
| `--all` | 同时显示提示级别（notice）的问题 |
| `--level` | 显示的最低级别，默认 `warning`；`--all` 等于 `--level info` |

```text
$ clio check
notes/concepts/pratt-parser.md
  14   warning wanted                link to missing note `tokenizer`
  21   warning missing-anchor        no heading `基准` in `parser-generators`

206 notes · 211 files · 1834 links · 1 wanted · 0 errors · 2 warnings · 9 notices
```

每行依次是行号、级别、检查码、说明。最后一行是汇总，不论显示哪个级别，汇总都包含全部三个级别的数量。

退出码：有错误时为 1；加 `--strict` 时有警告也为 1；否则为 0。

### clio show

```text
clio show <id> [--lang en] [--json]
```

一篇笔记的标题、id、类型、路径、摘要、标签、章节，以及两个方向的类型关系和普通反向链接。参数可以是 id、别名或标题，解析规则和 `[[ ]]` 链接相同。

```text
$ clio show pratt-parser
Pratt 解析器  pratt-parser · concept · notes/concepts/pratt-parser.md
按运算符优先级递归解析表达式的方法。
tags: #parser #compilers

Sections
- 算法
- 结合性

→ 依赖
  词法分析器 tokenizer
← 被依赖
  表达式引擎 expr-engine

← linked from (2)
  递归下降 recursive-descent
  解析器对比 parser-comparison
```

找不到笔记时报错退出（退出码 1）。

### clio backlinks

```text
clio backlinks <id> [--json]
```

只看指向这篇笔记的内容：按反向标签分组的类型关系，以及普通链接和链接所在的句子。

```text
$ clio backlinks pratt-parser
被依赖
  表达式引擎 expr-engine
linked from (2)
  递归下降 recursive-descent
    Pratt 解析器（[[pratt-parser]]）是它的一个变体。
  解析器对比 parser-comparison
    手写方案里 [[pratt-parser]] 最短。
```

### clio search

```text
clio search <query> [--limit N] [--json]
```

BM25 全文搜索，覆盖标题、别名、标签、章节标题和正文，权重依次为 4、2.5（别名和标签）、1.5、1。中文切成单字和相邻两字的组合，英文按单词切分，所以中英混合的查询也能用。默认返回 10 条。

```text
$ clio search 优先级 解析 --limit 3
Pratt 解析器  pratt-parser · concept · notes/concepts/pratt-parser.md
  优先级爬升的最小实现，见递归下降。
运算符优先级表  operator-table · concept · notes/concepts/operator-table.md
  每一行是一个优先级，从低到高排列。
递归下降  recursive-descent · concept · notes/concepts/recursive-descent.md
  每个语法规则对应一个函数。
```

没有结果时打印 `no matches`，退出码仍为 0。

### clio context

```text
clio context <id> [--hops N] [--json]
```

把一篇笔记的源文件和它周围的笔记整理成一段 Markdown，直接放进语言模型的上下文。`--hops` 默认 1，最大 3：1 表示只有直接相连的笔记，2 再加上邻居的邻居。

```text
$ clio context pratt-parser --hops 2
# Pratt 解析器 (pratt-parser, concept)

path: notes/concepts/pratt-parser.md

---
title: Pratt 解析器
…（笔记源文件全文）

## Direct relations

- → depends-on **词法分析器** (`tokenizer`): 把源代码切成 token。
- ← link **递归下降** (`recursive-descent`): 每个语法规则对应一个函数。

## Further notes (up to 2 hops)

- **解析器生成器** (`parser-generators`, concept, hop 2): 从文法自动生成解析器。

## Wanted (linked but not written yet)

- operator-precedence-climbing
```

### clio resolve

```text
clio resolve <text> [--json]
```

一个 id、别名或标题指向哪篇笔记。解析顺序：id → 别名 → 标题 → 路径，不区分大小写，空格和 `_` 当作 `-`。用来在写链接之前确认目标。

```text
$ clio resolve "优先级爬升"
pratt-parser  notes/concepts/pratt-parser.md
```

没有匹配时打印 `no match`，退出码为 1。

### clio stats

```text
clio stats [--json]
```

知识库概况：笔记、文件、链接、待写笔记、字数和标签的数量，按类型计数，以及自动聚类和每个聚类的大小。

```text
$ clio stats
我的知识库
206 notes · 211 files · 1834 links · 1 wanted · 58210 words · 47 tags

Types
  主题       12
  概念       81
  实体       34
  来源       52
  问答       27

Clusters
  #parser                  31
  #llm                     28
  Transformer              17
```

聚类的命名规则见 [[knowledge-graph#Louvain 社区]]。

## 维护

### clio mv

```text
clio mv <old-id> <new-id>
```

重命名笔记：改文件名（所有语言版本一起改），并改写整个知识库里指向它的每个链接，包括 `[[old-id|文字]]`、`[[rel::old-id]]`、`![[old-id#章节]]` 和 frontmatter 里的 `rel`。只是移动文件到别的目录时不需要这个命令，链接按 id 解析，不受路径影响。

```text
$ clio mv pratt pratt-parser
renamed notes/concepts/pratt.md → notes/concepts/pratt-parser.md
renamed notes/concepts/pratt.en.md → notes/concepts/pratt-parser.en.md
rewrote 7 links in 5 files
```

`<new-id>` 已被占用时报错退出，不改动任何文件。

### clio translate-status

```text
clio translate-status
```

列出缺失的翻译和过期的翻译。过期指译文的 `translation-of-hash` 与原文当前的哈希不同。每条都给出应写入的哈希。工作流见 [[multilingual]]。

```text
$ clio translate-status
missing (2)
  notes/concepts/tokenizer.md          en
  notes/topics/compilers.md            en
stale (1)
  notes/concepts/pratt-parser.en.md    translation-of-hash: "9c1e0b7a4d2f"
```

## Agent 接口

### clio mcp

```text
clio mcp [--dir <vault>]
```

在 stdio 上运行一个 MCP（Model Context Protocol）服务，把 `search`、`show`、`backlinks`、`context` 和 `check` 提供为工具，参数和 JSON 结果与同名命令一致。日志写到 stderr。

在 Claude Code 中注册：

```bash
claude mcp add clio -- clio mcp --dir ~/my-kb
```

其他客户端的通用配置：

```json
{ "mcpServers": { "clio": { "command": "clio", "args": ["mcp", "--dir", "/home/me/my-kb"] } } }
```

## JSON 输出

加 `--json` 后，命令把结果作为一个 JSON 值写到 stdout（两格缩进），不带颜色和额外文字。字段名是稳定的，Agent 应当依赖字段名而不是文本格式。

**check** 输出一个对象，含 `summary` 和 `diags`。`summary` 有 `notes`（笔记数，一篇笔记的各语言版本算一篇）、`files`、`edges`（链接数）、`wanted`、`clusters`、`errors`、`warnings`、`infos`。`diags` 是数组，每项有 `path`（相对知识库根目录）、`level`（`error`、`warning` 或 `info`）、`line`（从 1 开始）、`code` 和 `message`，按路径排序，并按 `--level` 过滤。

```json
{
  "summary": { "notes": 206, "files": 211, "edges": 1834, "wanted": 1, "clusters": 9, "errors": 0, "warnings": 1, "infos": 9 },
  "diags": [
    { "path": "notes/concepts/pratt-parser.md", "level": "warning", "line": 14, "code": "wanted", "message": "link to missing note `tokenizer`" }
  ]
}
```

**search** 输出一个数组，按相关度从高到低。每项有 `id`、`title`、`type`、`path`、`url`、`score`（保留三位小数）和 `snippet`（正文中第一处命中所在的一行，截取命中附近约 120 个字符；没有命中时用摘要）。

**show** 输出一个对象，描述所选语言下的这篇笔记：`id`、`key`（规范化的 id）、`lang`（请求的语言）、`noteLang`（实际使用的版本的语言）、`fallback`（没有该语言版本、用了默认语言时为 true）、`path`、`title`、`type`、`summary`、`tags`、`aliases`、`status`、`created`、`updated`、`reviewed`、`words`、`url`；`outline` 是二到四级标题（`depth`、`text`、`slug`）；`relations` 是类型关系，按标签分组，每组有 `label`、`direction`（`out` 或 `in`）和 `items`；`backlinks` 是普通链接的来源，每项带链接所在的句子 `context`；`local` 是局部图谱（`nodes` 和 `edges`）；`translations` 列出每种语言的 `lang`、`url`、`exists` 和 `title`；`hash` 是这个文件的内容哈希（写译文时填进 `translation-of-hash`），`sourceHash` 是默认语言版本的哈希，`translationOfHash` 是这个文件声明的值；还有 `rank`（PageRank）、`cluster`（聚类编号）和 `data`（全部 frontmatter 字段）。渲染好的 HTML 不包括在内。

**context** 输出一个对象：`note` 是这篇笔记（`id`、`title`、`type`、`path`、`summary`、`tags`、`aliases`、`text`、`headings`，以及源文件全文 `source`）；`relations` 是直接相连的边，每项有对方的 `id`、边的 `kind`（关系名，或 `link`、`embed`）、`direction` 和链接所在的句子 `context`；`neighbours` 是 `--hops` 范围内的笔记，每项有 `id`、`title`、`type`、`summary`、`path`、`tags` 和 `hop`（距离）；`wanted` 是这篇笔记链接到但还不存在的笔记名。

其余命令：`backlinks` 输出 `{ id, relations, backlinks }`，其中 `relations` 只含指向这篇笔记的方向；`resolve` 输出 `{ id, path }`，没有匹配时输出 `null`；`stats` 输出 `{ stats, types, clusters, lint }`。
