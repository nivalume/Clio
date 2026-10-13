---
title: 快速开始
summary: 安装 Clio，新建知识库，写第一篇笔记，检查、构建并部署上线。
tags: [setup, cli]
rel:
  part-of: index
  see-also: [vault-layout, cli]
updated: 2026-10-13
---
# 快速开始

这一页从零走一遍完整流程：安装 Clio，新建知识库，在浏览器里预览，写第一篇笔记，检查链接，构建静态网站，最后部署。每一步只讲最常用的用法，细节见每步里的链接。

## 准备

需要 [Bun](https://bun.sh) 1.2 或更高版本。Clio 的命令行是一个 Bun 程序；解析笔记的 Rust 引擎已经编译成 WebAssembly 随包发布，所以本机和部署平台都不需要安装 Rust。

```bash
bun --version   # 1.2.0 或更高
```

还没有 Bun 时，按 bun.sh 上的说明安装。macOS 和 Linux 上是：

```bash
curl -fsSL https://bun.sh/install | bash
```

## 步骤

:::steps
### 安装 Clio

```bash
bun add -g github:nivalume/Clio
clio --version
```

目前直接从 GitHub 安装，npm 发布在计划中。

### 新建知识库

```bash
clio new site my-kb
cd my-kb
bun install
```

`clio new site` 生成配置、目录、模板、主题、部署文件和 Agent Skill。默认的起步模板是 `llm-wiki`，适合个人或团队知识库；做文档站用 `--starter docs`，只要配置和首页用 `--starter blank`。要中英双语，加 `--locales zh,en`。

`bun install` 把 Clio 装进项目本身：生成的 `package.json` 依赖 `"clio": "github:nivalume/Clio"`。项目因此固定了自己的 Clio 版本，部署平台构建时用的也是这一版，和你全局安装的版本无关。

### 认识目录

```text
my-kb/
  clio.toml        站点标题、语言、类型、关系
  AGENTS.md        写给 Agent 的约定（CLAUDE.md 只有一行 @AGENTS.md）
  index.md         首页
  log.md           操作日志，只追加
  raw/             原始资料，只读
  notes/           笔记：sources/ concepts/ entities/ topics/ questions/
  templates/       每种笔记类型一个模板
  theme/           theme.css，覆盖颜色和字体
```

`notes/` 下的子目录决定笔记的默认类型，不代表主题。每个目录的用途和这样设计的原因见 [[vault-layout]]。

### 启动预览

```bash
clio dev
```

浏览器打开 `http://localhost:4321`。`clio dev` 先构建一次，然后监视文件，保存任何笔记后自动重建并刷新浏览器。端口被占用时加 `--port 8080`。

### 写第一篇笔记

```bash
clio new concept "向量检索" --id vector-search --tags search
```

这条命令用 `templates/concept.md` 生成 `notes/concepts/vector-search.md`。`--id` 是笔记的 id，也是文件名，链接时写的就是它，所以用简短的英文 kebab-case。打开文件，把内容改成：

```markdown title="notes/concepts/vector-search.md"
---
title: 向量检索
summary: 用向量相似度而不是关键词匹配来找文档。
tags: [search]
status: seed
created: 2026-10-13
updated: 2026-10-13
---
# 向量检索

把查询和文档都编码成向量，按余弦相似度排序。
它和 [[bm25]] 互补：BM25 擅长精确的词，向量擅长同义改写。

它 [[depends-on::embedding]]。
```

`[[bm25]]` 是普通链接。`[[depends-on::embedding]]` 是类型化链接，说明两篇笔记是「依赖」关系；`embedding` 的页面上会自动出现「被依赖 ← 向量检索」。两篇目标笔记都还不存在，这没有关系，见下一步。字段的含义见 [[writing-notes]]，链接的写法见 [[linking]]。

### 检查

```text
$ clio check
notes/concepts/vector-search.md
  12   warning wanted                link to missing note `bm25`
  14   warning wanted                link to missing note `embedding`

2 notes · 2 files · 2 links · 2 wanted · 0 errors · 2 warnings · 1 notices
```

每行依次是行号、级别、检查码和说明。`wanted` 表示链接到了还不存在的笔记，它是警告，不是错误：先写链接、后写笔记是正常的工作方式。这些待写笔记会出现在网站的「待写」列表里，在图谱中显示为幽灵节点。

只有错误（例如 frontmatter 不是合法的 YAML）会让 `clio check` 以退出码 1 结束。加 `--all` 还会显示提示级别的问题，例如没有任何笔记链接到的孤立笔记。全部检查码见 [[lint-codes]]。

### 构建

```bash
clio build
clio serve
```

`clio build` 把网站写到 `.clio/site`：每篇笔记一个静态 HTML 页面，加上前端应用、搜索索引和给语言模型读的 `llms.txt`。`clio serve` 在本地提供这个目录，用来检查准备部署的结果。

### 部署

把项目推到 GitHub，在 Vercel 导入这个仓库。项目里已经有 `vercel.json`，不需要改任何设置，之后每次推送都会自动部署。用 GitHub Pages 或其他静态托管的步骤见 [[deploy]]。
:::

## 下一步

- [[writing-notes]]：frontmatter 字段、类型、状态和模板。
- [[linking]]：类型化关系、反向链接和待写笔记。
- [[agents]]：让 Agent 按 LLM Wiki 模式收录资料、回答问题、维护知识库。
- [[cli]]：全部命令和参数。
