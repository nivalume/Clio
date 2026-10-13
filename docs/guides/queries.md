---
title: 查询
summary: clio-query 查询语言的语法、运算符、字段和显示方式，附在本手册上实际运行的例子。
tags: [query, syntax]
rel:
  part-of: index
  see-also: [syntax-cheatsheet, writing-notes]
updated: 2026-10-13
---
# 查询

`clio-query` 代码块在构建时执行，把结果直接写进页面：一个列表、一张表格或一组卡片。首页目录、主题枢纽和维护清单都用它生成；新增或修改笔记后，下次构建列表就自动更新，不会过时。本页的例子都在本手册上实际运行，看到的结果就是构建时手册里的页面。

## 第一个查询

列出所有指南，按标题排序，用表格显示摘要：

````markdown
```clio-query
type = guide SORT title SHOW table FIELDS summary
```
````

```clio-query
type = guide SORT title SHOW table FIELDS summary
```

## 语法

```text
[WHERE] <条件> [SORT 字段 [ASC|DESC], …] [LIMIT n] [SHOW list|table|cards] [FIELDS a, b, …]
```

| 子句 | 作用 | 省略时 |
|---|---|---|
| `WHERE <条件>` | 筛选；`WHERE` 这个词本身可以省略 | 全部笔记 |
| `SORT 字段 [ASC\|DESC], …` | 排序，可以有多个字段，靠前的优先；默认升序 | 按标题 |
| `LIMIT n` | 最多显示 n 条 | 不限 |
| `SHOW list\|table\|cards` | 显示方式，见 [[#显示方式]] | `list` |
| `FIELDS a, b, …` | 表格的列 | `type, updated` |

关键字不区分大小写，查询可以写在一行，也可以分成多行。条件是 `字段 运算符 值`，用 `AND`、`OR`、`NOT` 和括号组合：`NOT` 结合得最紧，其次是 `AND`，最后是 `OR`。值里有空格或特殊字符时加引号：`title ~ "vector search"`。

## 运算符

| 运算符 | 含义 | 例子 |
|---|---|---|
| `=` | 等于，不区分大小写 | `type = concept` |
| `!=` | 不等于 | `status != archived` |
| `~` | 包含子串，不区分大小写 | `title ~ 检索` |
| `!~` | 不包含子串 | `path !~ drafts` |
| `>` `<` `>=` `<=` | 比较：两边都是数字时按数值比较，否则按文本比较 | `words > 500`、`updated >= 2026-01-01` |

日期写成 `YYYY-MM-DD`，按文本比较的结果就是时间先后。

标签这样的多值字段，只要有一个值满足条件就算满足；`!=` 和 `!~` 则要求所有值都不满足。`tag = search` 也匹配 `search/vector` 这样的子标签。笔记没有某个字段时，`=` 不成立，`!=` 成立，所以 `status != archived` 也包括没写状态的笔记。

## 字段

| 字段 | 值 |
|---|---|
| `id` | 笔记 id |
| `title` | 标题 |
| `type` | 类型 |
| `tag`（或 `tags`） | 标签，多值 |
| `status` | 状态 |
| `lang` | 所用版本的语言 |
| `path` | 相对知识库根目录的文件路径，例如 `guides/queries.md` |
| `folder` | 文件所在的目录，例如 `guides` |
| `created`、`updated`、`reviewed` | 日期 |
| `words` | 字数 |
| `in`（或 `backlinks`） | 指向这篇笔记的链接数 |
| `out`（或 `links`） | 这篇笔记发出的链接数 |
| `summary` | 摘要 |
| 其他名字 | frontmatter 里的同名字段 |

自定义字段直接用名字。给论文笔记加上 `year: 2017` 和 `venue: NeurIPS`，就可以写 `year >= 2015 AND venue = NeurIPS`。

## 显示方式

| `SHOW` | 显示 |
|---|---|
| `list` | 列表：标题链接，后面跟摘要（截到 90 字） |
| `table` | 表格：第一列是标题链接，其余列由 `FIELDS` 指定，默认 `type, updated` |
| `cards` | 卡片：标题链接和完整摘要 |

没有匹配时显示「没有匹配的笔记」。

## 例子

### 带某个标签的页面

````markdown
```clio-query
tag = cli
```
````

```clio-query
tag = cli
```

### 参考页，用卡片显示

````markdown
```clio-query
type = reference SHOW cards
```
````

```clio-query
type = reference SHOW cards
```

### 组合条件

指南或参考页中，带 `cli` 或 `config` 标签的：

````markdown
```clio-query
(type = guide OR type = reference) AND (tag = cli OR tag = config)
SHOW table FIELDS type, tags
```
````

```clio-query
(type = guide OR type = reference) AND (tag = cli OR tag = config)
SHOW table FIELDS type, tags
```

### 最长的页面

````markdown
```clio-query
SORT words DESC LIMIT 5 SHOW table FIELDS type, words
```
````

```clio-query
SORT words DESC LIMIT 5 SHOW table FIELDS type, words
```

### 被链接最少的页面

维护时用来找需要补链接的笔记：

````markdown
```clio-query
NOT id = index SORT in, title LIMIT 5 SHOW table FIELDS in, out
```
````

```clio-query
NOT id = index SORT in, title LIMIT 5 SHOW table FIELDS in, out
```

## 在首页里用

`index.md` 用查询按类型列出笔记，这样首页不需要手工维护。本手册的首页就是这样写的，生成的知识库也一样，见 [[vault-layout#index.md 与 log.md]]。

## 写错时

查询写错时，页面上查询的位置显示错误信息，`clio check` 报告 `query` 警告，带行号：

```text
notes/topics/search.md
  12   warning query                 query 1: expected a value after `type`, found end of query
```

## 注意

- 查询结果不算链接。只出现在查询结果里的笔记，在图谱里没有对应的边，`clio check --all` 可能仍然报告它是孤立笔记（`orphan`）。主题笔记里重要的条目应当手写链接。
- 每篇笔记只占一行，不论有几个语言版本。在英文页面上，有英文版的笔记显示英文版的标题、摘要和字段。
- 查询在构建时执行，静态页面里存的是结果，浏览器不需要运行查询。
