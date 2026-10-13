---
title: 写笔记
summary: frontmatter 的每个字段、七种内置类型、状态的生命周期、摘要的写法，以及 clio new、模板、别名、标签和日期。
tags: [notes, frontmatter]
rel:
  part-of: index
  see-also: [linking, syntax-cheatsheet]
updated: 2026-10-13
---
# 写笔记

一篇笔记是一个 Markdown 文件：开头是 YAML frontmatter，记录标题、类型、标签、关系等元数据，后面是正文。这一页讲 frontmatter 的每个字段，以及把一篇笔记写好的约定。本页 [[depends-on::vault-layout]]：笔记的默认类型来自它所在的目录。

## 一篇完整的笔记

```markdown title="notes/concepts/bm25.md"
---
title: BM25
summary: 按词频和文档长度给关键词匹配打分的排序函数，是全文搜索的常用基线。
aliases: [Okapi BM25]
tags: [search, ranking]
status: draft
created: 2026-10-10
updated: 2026-10-13
rel:
  part-of: search
  source: robertson-2009
---
# BM25

BM25 给每个查询词算一个分数再相加。词在文档里出现得越多，分数越高，但增长会饱和；
文档越长，单个词的权重越低。

它和 [[vector-search]] 互补：精确的词匹配得好，同义改写匹配得差。
```

frontmatter 里的字段都可以省略，省略时用下表的默认值。

## 字段

| 字段 | 默认值 | 作用 |
|---|---|---|
| `id` | 文件名去掉 `.md` | 全局唯一的标识，链接用它。一般不写，由文件名充当 |
| `title` | 正文第一个一级标题，没有时用 id | 显示在页面、链接文字、列表和搜索结果里 |
| `type` | 按目录映射，没有映射时为 `note` | 笔记类型，见 [[#类型]] |
| `aliases` | 无 | 别名列表，链接可以写别名，见 [[#别名]] |
| `tags` | 无 | 标签列表，和正文里的标签合并，见 [[#标签]] |
| `status` | 无 | `seed`、`draft`、`stable` 或 `archived`，见 [[#状态]] |
| `summary` | `description` 字段，再没有就取正文第一段 | 一句话摘要，见 [[#摘要]] |
| `created` | 无 | 创建日期，`YYYY-MM-DD` |
| `updated` | 无 | 最后一次实质修改的日期 |
| `reviewed` | 无 | 最后一次核对内容的日期，见 [[#日期与过期]] |
| `rel` | 无 | 类型化关系：关系名 → id 或 id 列表，见 [[linking#类型化关系]] |
| `lang` | 由文件名决定 | 语言，例如 `en`，通常不写，见 [[multilingual]] |
| `translation-of-hash` | 无 | 译文对应的原文版本，只用在译文里，见 [[multilingual]] |

其他任何字段都会原样保留，可以在查询里使用。例如给论文笔记加上 `year: 2017`，就能用 `year >= 2015` 筛选，见 [[queries]]。

## 类型

类型说明一篇笔记是什么，而不是关于什么。内置七种：

| 类型 | 中文 | 默认目录 | 用途 |
|---|---|---|---|
| `topic` | 主题 | `notes/topics/` | 枢纽笔记：综述一个领域，组织相关笔记 |
| `concept` | 概念 | `notes/concepts/` | 一个概念、方法或原理 |
| `entity` | 实体 | `notes/entities/` | 人、组织、产品、项目 |
| `source` | 来源 | `notes/sources/` | 一份原始资料的摘要和要点，指向 `raw/` 里的原件 |
| `question` | 问答 | `notes/questions/` | 回答过的问题、比较、分析 |
| `journal` | 日志 | `journal/` | 日记 |
| `note` | 笔记 | 其他位置 | 未分类 |

类型决定页面上的图标和颜色、图谱里节点的形状，也是查询最常用的筛选条件。不同类型的写法不同：来源笔记忠于原文，概念笔记综合多个来源，主题笔记主要由链接和导读组成。

增加类型（例如 `paper`）或给某个类型规定必填字段，在 `clio.toml` 里配置，见 [[customizing]]。

## 状态

`status` 表示一篇笔记成熟到什么程度：

| 状态 | 含义 |
|---|---|
| `seed` | 种子：只有标题、一两句话或几个链接，先占一个位置 |
| `draft` | 草稿：内容成形，但还没核对，可能有遗漏 |
| `stable` | 稳定：核对过来源，别的笔记可以放心引用 |
| `archived` | 归档：过时或被取代，保留是为了历史和旧链接 |

正常的路径是 seed → draft → stable，过时后转为 archived。`clio ingest` 新建的来源笔记是 `draft`。引擎不强制状态的流转，它的作用在查询和维护上，例如列出所有还是种子的笔记：

```text
status = seed SORT updated
```

## 摘要

`summary` 用一句话说清这篇笔记的结论或定义。它出现在查询列表、预览、搜索结果、反向链接列表里，也出现在 `clio context` 交给 Agent 的邻居列表里。Agent 通常先读摘要，再决定打开哪篇笔记，所以摘要是整个知识库里被读得最多的文字。

写法：

- 写结论，不写「本文介绍了……」。「BM25 按词频和文档长度打分」比「关于 BM25 的笔记」有用。
- 一句话，八十字以内。
- 不放链接和格式，摘要以纯文本显示。

没写 `summary` 时，Clio 用 `description` 字段；再没有就取正文第一段，截到 160 字。自动截出的摘要常常是半句话，所以重要的笔记都应该手写摘要。

## 用 clio new 创建

```bash
clio new concept "BM25" --id bm25 --tags search,ranking
clio new topic "搜索" --id search
clio new concept "BM25" --id bm25 --lang en     # 给已有的笔记建英文版
```

`clio new <类型> <标题>` 读取 `templates/<类型>.md`，替换其中的变量，存到这个类型对应的目录。可用的变量：

| 变量 | 值 |
|---|---|
| `{{title}}` | 命令里的标题 |
| `{{id}}` | `--id` 的值，默认由标题生成 |
| `{{date}}` | 今天，`YYYY-MM-DD` |
| `{{lang}}` | `--lang` 的值，默认是默认语言 |
| `{{type}}` | 类型名 |

一个概念模板：

```markdown title="templates/concept.md"
---
title: "{{title}}"
summary: ""
tags: []
status: seed
created: {{date}}
updated: {{date}}
---
# {{title}}

一句话定义。

## 原理

## 例子

## 来源
```

`title` 加了引号，因为标题里可能有冒号，不加引号时替换后的 YAML 可能不合法。模板是普通文件，按自己的习惯改即可。

## 别名

`aliases` 列出这篇笔记的其他叫法：缩写、全称、英文名、旧名字。

```yaml
aliases: [Okapi BM25, BM-25]
```

链接时写别名也能解析到这篇笔记：`[[Okapi BM25]]` 显示的是笔记标题「BM25」。搜索同样匹配别名。一个别名对应多篇笔记时，`clio check` 报告 `ambiguous-link` 警告，链接指向其中第一篇。写链接前不确定时，用 `clio resolve <文字>` 查看一个名字指向哪篇笔记。

## 标签

标签用于跨类型、跨主题的分类。可以写在 frontmatter 的 `tags` 里，也可以在正文里写 `#search`，两处合并。

- 标签可以分层：`search/vector`。查询 `tag = search` 也匹配 `search/vector`。
- 正文里的标签必须含非数字字符，`#2024` 不是标签；代码、链接和标题里的 `#` 也不算。
- 每个标签有自己的页面，列出带这个标签的笔记。

标签不代替链接。要说明两篇笔记之间的关系，用链接；标签只回答「这篇属于哪一类」。

## 日期与过期

`created`、`updated` 和 `reviewed` 都写成 `YYYY-MM-DD`：

- `updated`：内容有实质修改时改成当天。
- `reviewed`：重新读过、核对过、确认仍然正确时改成当天，即使内容没变。

`reviewed`（没有时用 `updated`）早于 `clio.toml` 的 `stale_days`（默认 180 天）时，`clio check --all` 报告 `stale` 提示。知识会过时，这个提示把需要重读的笔记找出来；核对完把 `reviewed` 改成当天即可。

找出长期没动过的笔记也可以用查询：

```text
updated < 2026-01-01 AND status != archived SORT updated
```
