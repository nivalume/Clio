---
title: 检查码
summary: clio check 报告的每个检查码：级别、含义、触发示例和修法。
tags: [lint, reference]
rel:
  part-of: index
  see-also: [cli, agents]
updated: 2026-10-13
---
# 检查码

[[cli#clio check]] 检查整个知识库，每个问题带一个检查码。这一页列出全部检查码：级别、含义、一个会触发它的例子、怎么修。Agent 定期跑 `clio check --json` 并按这里的修法处理，是知识库保持干净的主要手段，见 [[agents]]。

## 级别

| 级别 | JSON 中的 `level` | 默认显示 | 影响退出码 |
|---|---|---|---|
| 错误 | `error` | 是 | 有错误时退出码为 1 |
| 警告 | `warning` | 是 | 只有加 `--strict` 时 |
| 提示 | `info` | 只有加 `--all` 或 `--level info` 时 | 否 |

错误表示知识库的数据不可信（frontmatter 读不出来、id 冲突、原始资料被改）。警告表示某个链接、关系或块没有按你的意图生效。提示是维护线索：没人链接的笔记、很久没复查的笔记、缺的翻译。

## 一览

| 检查码 | 级别 | 含义 |
|---|---|---|
| [[#frontmatter]] | 错误 | frontmatter 不是合法的 YAML |
| [[#duplicate-id]] | 错误 | 两个文件在同一种语言下用了同一个 id |
| [[#raw-modified]] | 错误 | `raw/` 里的文件在收录后被改过或删除 |
| [[#wanted]] | 警告 | 链接到不存在的笔记 |
| [[#missing-anchor]] | 警告 | 链接的章节或块在目标笔记里不存在 |
| [[#ambiguous-link]] | 警告 | 别名或标题匹配到多篇笔记 |
| [[#unknown-relation]] | 警告 | 使用了没有声明的关系 |
| [[#unknown-directive]] | 警告 | 使用了未知的指令名 |
| [[#empty-link]] | 警告 | 空的 `[[ ]]` |
| [[#required-field]] | 警告 | 缺少该类型要求的 frontmatter 字段 |
| [[#translation-stale]] | 警告 | 译文对应的原文版本已经变了 |
| [[#part-of-cycle]] | 警告 | `part-of` 关系形成了环 |
| [[#query]] | 警告 | `clio-query` 代码块有语法错误 |
| [[#orphan]] | 提示 | 没有其他笔记链接到这里 |
| [[#empty-note]] | 提示 | 笔记没有正文 |
| [[#stale]] | 提示 | 很久没有复查 |
| [[#translation-missing]] | 提示 | 缺少某种语言的版本 |
| [[#translation-unpinned]] | 提示 | 译文没有写 `translation-of-hash` |
| [[#callout-type]] | 提示 | 使用了自定义的 callout 类型 |

## 错误

### frontmatter

文件开头的 `---` 块不是合法的 YAML。这篇笔记的元数据全部丢失：标题、类型、标签、关系都退回默认值。

```markdown
---
title: Pratt 解析器
tags: [parser, compilers
---
```

修法：修正 YAML 语法。常见原因是方括号或引号没有闭合，或者值里含有 `: ` 却没有加引号（`summary: 结论: 更快` 要写成 `summary: "结论: 更快"`）。

### duplicate-id

两个文件解析出同一个 id，并且语言相同。id 默认是不带 `.md` 的文件名，也可以在 frontmatter 里用 `id` 指定；它是全局的，与所在目录无关。

```text
notes/concepts/attention.md      → id attention
notes/sources/attention.md       → id attention
```

第二个文件被跳过，指向 `attention` 的链接都落到第一个文件上。修法：给其中一个改名，用 [[cli#clio mv]] 可以同时改写已有的链接。同一篇笔记的不同语言版本（`attention.md` 和 `attention.en.md`）不算重复。

### raw-modified

`raw/` 里的原始资料在收录之后被修改了：它当前的 sha256 与来源笔记 frontmatter 里记录的 `sha256` 不一致。`raw:` 指向的文件不存在时也报告这个错误。原始资料是只读的，来源笔记和引用它的结论都以收录时的内容为准。

只有同时写了 `raw:` 和 `sha256:` 的笔记才做这项检查。它由 Bun 命令行完成，不在引擎里：引擎不读文件系统，命令行读取 `raw/` 里的文件计算哈希。`clio check`、`clio build` 和 `clio mcp` 的 `check` 工具都包含这项检查。

```yaml
# notes/sources/attention-is-all-you-need.md
raw: raw/attention-is-all-you-need.pdf
sha256: 3f2a9c…e81b      # 文件现在的哈希不是这个
```

修法：如果修改或删除是误操作，从版本库恢复原文件。如果确实需要新版本，用 [[cli#clio ingest]] 把新文件作为一份新资料收录，再更新引用它的笔记。

## 警告

### wanted

链接指向一篇不存在的笔记。链接仍然渲染，指向「待写笔记」页面；图谱里出现一个幽灵节点。待写笔记是有意的待办清单，所以这是警告而不是错误。

```markdown
它把输入交给 [[tokenizer]] 处理。
```

修法：写出这篇笔记（`clio new concept 词法分析器 --id tokenizer`），或者把链接改成已有笔记的 id、别名或标题。用 [[cli#clio resolve]] 确认一个名字会解析到哪里。解析规则见 [[syntax-cheatsheet^resolve-order]]。

### missing-anchor

链接指定了章节（`#标题`）或块（`^块id`），但目标笔记里没有这个标题或块。检查的是链接所在语言的那个版本。

```markdown
见 [[pratt-parser#性能]]，结论在 [[benchmarks^run-3]]。
```

链接仍然指向目标笔记，只是不跳到具体位置。修法：改成目标笔记里实际存在的标题文字，或者在目标段落末尾加上 `^run-3`。章节标题改名后，指向它的链接都会报这个警告。

### ambiguous-link

链接文字不是任何笔记的 id，但作为别名或标题匹配到了多篇笔记。Clio 使用其中的第一篇（按 id 排序）。

```markdown
# 两篇笔记都有 aliases: [attention]
见 [[attention]]。
```

修法：改用目标笔记的 id 链接，或者删掉其中一篇的重复别名。

### unknown-relation

`[[关系::id]]` 或 frontmatter `rel:` 里的关系名既不是已声明的关系，也不是某个关系的反向名。链接照常生效，但关系的标签和反向标签都没有定义。

```markdown
它 [[implements::raft]]。
```

修法：在 `clio.toml` 里用 `[[relations]]` 声明这个关系（见 [[config#relations]]），或者改用内置关系，例如 `depends-on`、`example-of`。

### unknown-directive

`:::名字` 中的名字不是已知的指令。这个块作为普通的 `div` 渲染，内容保留。

```markdown
:::timeline
…
:::
```

修法：检查拼写（已知的指令有 `tabs`、`tab`、`cards`、`card`、`steps`、`details`、`columns`、`column`，以及与 callout 同名的提示块，如 `note`、`warning`），或者改用 callout 或普通 Markdown。指令语法见 [[rich-content]]。

### empty-link

`[[]]` 或 `[[ ]]` 里没有目标。它按原样显示为文字，不生成链接。

```markdown
这里以后补一个链接 [[ ]]。
```

修法：填上目标，或者删掉。

### required-field

`clio.toml` 中这种类型的 `required` 列出了某个字段，这篇笔记的 frontmatter 里没有它。

```toml
[types.paper]
required = ["summary"]
```

修法：在 frontmatter 里补上这个字段。要放宽规则就改 `required`，见 [[config#types]]。

### translation-stale

译文的 `translation-of-hash` 与原文（默认语言版本）当前的内容哈希不一致：原文在翻译之后改过。这个警告报在译文文件上。

```yaml
# notes/concepts/pratt-parser.en.md
translation-of-hash: "9c1e0b7a4d2f"   # 原文现在的哈希是 41d07c3e9a55
```

修法：对照原文的改动更新译文，再把 `translation-of-hash` 改成原文的新哈希。[[cli#clio translate-status]] 列出所有过期译文和应写入的哈希，`clio show <id> --json` 的 `hash` 字段也是这个值。流程见 [[multilingual]]。

### part-of-cycle

`part-of` 关系形成了环，例如 A 属于 B，B 又属于 A。`part-of` 用来表达层级，环会让面包屑和层级导航无法确定。

```yaml
# notes/topics/parsing.md
rel: { part-of: compilers }
# notes/topics/compilers.md
rel: { part-of: parsing }
```

修法：去掉环上的一条 `part-of`，或者把它改成 `see-also`。

### query

`clio-query` 代码块无法解析。页面上在代码块的位置显示错误信息，其余内容照常渲染。

````markdown
```clio-query
type = concept SORT updated DSC
```
````

这里 `DSC` 不是关键字，检查结果是 ``query 1: unexpected `DSC` ``（`1` 表示这篇笔记里的第一个查询块）。修法：按查询语法修改（这里应为 `DESC`），语法见 [[queries]]。错误信息会指出期望的内容，例如 ``expected a value after `type`, found end of query``。

## 提示

提示只在 `clio check --all` 时显示。

### orphan

没有其他笔记链接到这篇。首页（id 为 `index` 或 `home`）不报。查询块列出的笔记不算链接。

修法：在相关的主题笔记或概念笔记里链接它，或者给它加一个 `part-of` 关系指向所属的主题。确实不再需要的笔记，把 `status` 改为 `archived` 或删除。

### empty-note

笔记除了 frontmatter 没有任何文字。通常是 `clio new` 建好之后还没写。

修法：写正文，或者删除。

### stale

`reviewed` 日期（没有时用 `updated`）距今超过 `stale_days`（默认 180 天）。两个字段都没有的笔记不检查。

```yaml
updated: 2025-01-04
```

修法：复查内容，确认无误后把 `reviewed` 改成今天的日期。要调整期限，改 `clio.toml` 的 `stale_days`。

### translation-missing

知识库启用了多种语言，但这篇笔记缺少某种语言的版本。报在默认语言的文件上，每缺一种语言一条。

修法：新建译文（`clio new <type> <title> --lang en`，或直接建 `<id>.en.md`），或者接受缺失：访问该语言的页面时会显示默认语言版本，并标明是回退。

### translation-unpinned

译文没有 `translation-of-hash`，所以无法判断它是否过期。

修法：在译文 frontmatter 里加上提示信息给出的哈希，例如 `translation-of-hash: "41d07c3e9a55"`。

### callout-type

`> [!类型]` 用了已知列表以外的类型名。它照常渲染为 callout，使用默认样式。

```markdown
> [!recipe] 做法
```

修法：如果是拼写错误，改成已知类型（`note`、`tip`、`warning` 等，完整列表见 [[rich-content]]）；如果是有意的自定义类型，可以忽略这条提示，并在 `theme/theme.css` 里给它加样式。
