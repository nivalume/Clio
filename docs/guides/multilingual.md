---
title: 多语言
summary: 语言配置、译文命名、链接回退、网址格式，以及用 translation-of-hash 和 clio translate-status 跟踪过期译文。
tags: [i18n, translation]
rel:
  part-of: index
  see-also: [lint-codes, config]
updated: 2026-10-13
---
# 多语言

一个 Clio 知识库可以同时有几种语言的版本。每篇笔记的各个译文共用一个 id，链接不用区分语言；每份译文记录它译自原文的哪个版本，原文改了，Clio 能指出哪些译文需要跟着改。本手册本身就是中英双语。

## 配置语言

在 `clio.toml` 里列出语言，第一个是默认语言：

```toml
locales = ["zh", "en"]
```

只有一种语言时（默认 `["zh"]`），网址里没有语言前缀，界面上也没有语言切换。

## 文件命名

译文和原文放在同一个目录，文件名加上语言代码：

| 文件 | id | 语言 |
|---|---|---|
| `notes/concepts/bm25.md` | `bm25` | `zh`（默认语言） |
| `notes/concepts/bm25.en.md` | `bm25` | `en` |

也可以不改文件名，在 frontmatter 里写 `lang: en`。用文件名更直观，两个版本在文件列表里挨在一起。

每个版本有自己的 frontmatter：`title`、`summary`、`aliases` 用这种语言写；`tags`、`rel`、`status` 等通常和原文一致。译文的标题和别名同样可以用来写链接。

```bash
clio new concept "BM25" --id bm25 --lang en   # 新建 notes/concepts/bm25.en.md
```

`bm25` 已经存在时，这条命令把原文复制成 `bm25.en.md`，标题换成命令里给的标题，正文留给你翻译。

`clio new site --locales zh,en` 新建项目时，起步模板里的笔记已经带有译文，并且写好了 `translation-of-hash`。

## 链接与回退

链接写 id，不写语言。同一个 `[[bm25]]` 在中文页面上指向中文版，在英文页面上指向英文版，显示的也是那种语言的标题。

目标还没有英文版时，链接仍然指向 `/en/n/bm25`，这个页面显示默认语言的内容，并标明这是回退的版本。所以英文站点是完整的：每篇笔记都有页面，只是有些还没翻译。

链接到小节时，小节名按目标在这种语言里的标题匹配：中文页面写 `[[bm25#原理]]`，英文页面写 `[[bm25#How it works]]`。小节名写错时报告 `missing-anchor` 警告。

## 网址

| 站点 | 笔记页面 |
|---|---|
| 多语言 | `/zh/n/<id>`、`/en/n/<id>` |
| 单语言 | `/n/<id>` |

网址前面还要加上 `clio.toml` 里的 `base`，例如 `base = "/kb/"` 时是 `/kb/zh/n/<id>`。

网站根目录在第一次访问时按浏览器语言选择版本，之后用户可以在界面上切换。每个页面都链接到它的其他语言版本。

## 翻译工作流

每个文件有一个内容哈希：对整个文件（包括 frontmatter）计算的 12 位十六进制数。译文在 frontmatter 里用 `translation-of-hash` 记下它译自的原文哈希：

```yaml
---
title: BM25
summary: A ranking function that scores keyword matches by term frequency and document length.
translation-of-hash: "9c1e0b7a4d2f"
---
```

哈希要加引号：全是数字的哈希不加引号会被 YAML 读成数字。

原文之后的任何修改，包括只改了 `updated` 日期，都会改变原文的哈希，`clio check` 随即报告这份译文 `translation-stale`。这是有意的：Clio 不判断改动是否影响意思，由人或 Agent 看一眼再决定。

:::steps
### 修改原文

照常编辑默认语言的版本。

### 找出需要处理的译文

```bash
clio translate-status
```

它分三组列出需要处理的译文：缺失的（`missing`）、没写哈希的（`unpinned`）和过期的（`stale`），并给出每篇应该写入的哈希。加 `--lang en` 只看一种语言。也可以用 `clio show <id> --json` 查看一篇笔记的 `hash` 字段。

### 更新译文

对照原文的改动更新译文。改动不影响译文时（例如只改了错别字或日期），不用改正文。

### 写入哈希

```bash
clio translate-status --pin bm25
```

`--pin` 把原文当前的哈希写进 `bm25` 所有语言译文的 `translation-of-hash`；加 `--lang en` 时只写英文版。几篇一起时用逗号分隔 id。也可以手工把清单里给出的哈希写进 `translation-of-hash`。

### 检查

```bash
clio check
```

没有 `translation-stale` 警告，就说明所有译文都对应原文的当前版本。
:::

## 相关检查

| 检查码 | 级别 | 含义 |
|---|---|---|
| `translation-missing` | 提示 | 某种语言还没有这篇笔记的版本 |
| `translation-unpinned` | 提示 | 译文没写 `translation-of-hash`，提示里给出应写的值 |
| `translation-stale` | 警告 | 译文的 `translation-of-hash` 和原文当前的哈希不同 |
| `missing-anchor` | 警告 | 链接里的小节名在目标的这种语言版本里不存在 |

提示级别的问题要加 `--all` 才显示。全部检查码见 [[lint-codes]]。

## 让 Agent 翻译

翻译是适合交给 Agent 的工作：`clio translate-status --json` 给出待处理的清单，Agent 逐篇翻译，用 `clio translate-status --pin <id>` 写入哈希，最后跑 `clio check` 确认。具体流程见 [[agents#翻译]]。
