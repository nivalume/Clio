---
title: 链接
summary: 每种链接写法及其效果、类型化关系与反向标签、反向链接、待写笔记、Markdown 链接、解析规则，以及这样设计的理由。
tags: [links, graph]
rel:
  part-of: index
  see-also: [knowledge-graph, syntax-cheatsheet]
updated: 2026-10-13
---
# 链接

链接是 Clio 知识库的骨架。每个链接在构建时解析到一篇确定的笔记，可以带上关系类型；被链接的页面自动显示谁指向了它。链接到还不存在的笔记也可以，它会成为待写笔记。本页 [[depends-on::writing-notes]]：笔记的 id、标题和别名在那里介绍。

## 写法

下表「效果」一列是真实的链接，指向本手册的其他页面。

| 写法 | 效果 | 说明 |
|---|---|---|
| `[[vault-layout]]` | [[vault-layout]] | 显示目标的标题 |
| `[[vault-layout\|自定义文字]]` | [[vault-layout\|自定义文字]] | 显示 `\|` 后面的文字 |
| `[[快速开始]]` | [[快速开始]] | 用标题或别名链接，解析到同一篇笔记 |
| `[[vault-layout#id 与路径]]` | [[vault-layout#id 与路径]] | 链接到小节，显示「标题 › 小节」 |
| `[[vault-layout^ids-stable]]` | [[vault-layout^ids-stable]] | 链接到带块 id 的段落 |
| `[[#嵌入]]` | [[#嵌入]] | 本页的小节 |
| `[[see-also::knowledge-graph]]` | [[see-also::knowledge-graph]] | 类型化链接：显示和普通链接一样，另外记录关系 |
| `[目录结构](vault-layout.md)` | [目录结构](vault-layout.md) | 标准 Markdown 链接，同样算作链接 |

小节名不区分大小写，空格和 `-` 等价。块 id 的写法见 [[rich-content#块 id]]。

## 嵌入

一个段落里只有 `![[…]]` 时，目标的内容嵌入当前页面：

| 写法 | 嵌入的内容 |
|---|---|
| `![[id]]` | 整篇笔记 |
| `![[id#小节]]` | 一个小节，到下一个同级或更高级的标题为止 |
| `![[id^块]]` | 一个段落或列表项 |
| `![[图片.png]]`、`![[图片.png\|说明]]` | 图片，在整个知识库里按文件名查找 |

下面这一段的源码是 `![[vault-layout^ids-stable]]`：

![[vault-layout^ids-stable]]

嵌入最多三层，循环嵌入会被截断并给出说明。嵌入是引用而不是复制：原文改了，所有嵌入它的页面在下次构建时一起更新。

## 类型化关系

普通链接只说明两篇笔记有关。类型化链接还说明是什么关系，有两种写法，效果相同。

写在正文里，适合关系本身就是一句话的情况：

```markdown
向量检索 [[depends-on::embedding]]，它的实验结果 [[contradicts::keyword-only-search]]。
```

写在 frontmatter 的 `rel` 下，适合描述整篇笔记的关系，例如归属：

```yaml
rel:
  part-of: search
  depends-on: [embedding, ann-index]
  source: "[[robertson-2009]]"
```

值可以是一个 id、一个 id 列表，也可以是 `[[id]]` 形式。`[[id]]` 形式要加引号，否则 YAML 会把它当成嵌套列表。

内置关系：

| 关系 | 反向（显示在目标页） | 中文标签 | 什么时候用 |
|---|---|---|---|
| `depends-on` | `used-by` | 依赖 / 被依赖 | 理解或实现 A 需要先有 B |
| `part-of` | `has-part` | 属于 / 包含 | A 是 B 的一部分，或 A 归属于主题 B |
| `supports` | `supported-by` | 支持 / 被支持 | A 是支持 B 的证据或论证 |
| `source` | `cited-by` | 来源 / 被引用 | A 的内容出自 B，B 通常是来源笔记 |
| `extends` | `extended-by` | 扩展 / 被扩展 | A 在 B 的基础上增加了东西 |
| `example-of` | `has-example` | 示例 / 有示例 | A 是 B 的一个实例 |
| `contradicts` | （对称） | 矛盾 | A 和 B 的结论冲突 |
| `see-also` | （对称） | 参见 | 值得一起读，但没有更具体的关系 |

用了没有声明的关系名时，`clio check` 报告 `unknown-relation` 警告。`part-of` 形成的层级不能有环，否则报告 `part-of-cycle`。在 `clio.toml` 里可以增加关系，见 [[customizing]]。

## 反向标签与反向链接

反向链接是算出来的，不存两份。A 写了 `[[depends-on::B]]`，这条关系只存在于 A 的文件里；构建时引擎把它反过来，B 的页面上显示：

```text
被依赖 ← A
```

每种关系都声明了反向名称和两个方向的标签，所以 B 的页面上读到的是「被依赖」，而不是「依赖」。对称关系（`contradicts`、`see-also`）两边显示同一个标签。也可以从另一端写：在 B 里写 `[[used-by::A]]`，效果和在 A 里写 `[[depends-on::B]]` 相同。

普通链接出现在目标页面的「链接到这里」列表中，每项附带链接前后的一段文字，不用点开就能知道对方是在什么语境下提到这篇笔记的。类型化链接只出现在它的关系标签下，不重复出现在这个列表里。

本页的 frontmatter 写了 `part-of: index`，所以首页 [[index]] 的「包含」一栏里有本页。命令行里用 `clio backlinks` 看同样的信息：

```text
$ clio backlinks embedding
被依赖
  向量检索 vector-search
linked from (1)
  语义搜索 semantic-search
    检索时先用 [[embedding]] 把问题编码成向量。
```

关系和反向链接如何组成知识图谱，见 [[knowledge-graph]]。

## 待写笔记

链接到不存在的笔记不是错误。这样的链接叫待写笔记（wanted）：

- 在页面上以待写的样式显示，指向网站的「待写」页面；
- 在图谱里显示为幽灵节点，能看到有哪些笔记在等它；
- `clio check` 报告 `wanted` 警告，`clio context` 在输出末尾列出它们。

先写链接、后写笔记是正常的工作方式：写到一个还没有笔记的概念时，直接写 `[[bm25]]`，不用停下来。被越多笔记链接的待写笔记越值得先写；对 Agent 来说，这份列表就是待办事项。只是提到一个词、不打算为它写笔记时，就不要加链接。

## Markdown 链接

标准 Markdown 链接指向 `.md` 文件时也算链接，和 `[[ ]]` 一样进入图谱和反向链接：

```markdown
[目录结构](vault-layout.md)
[id 与路径](../guides/vault-layout.md#id-与路径)
```

路径相对于当前文件。按路径找不到时（例如目标文件被移动过），Clio 用文件名当作 id 再找一次，所以在 Clio 生成的网站上链接仍然有效；但在 GitHub 上浏览源文件时，这个链接已经失效。指向 `https://` 的链接是普通的外部链接。

需要源文件在 GitHub 上也能点击时用 Markdown 链接，其他情况用 `[[ ]]`。

## 解析规则

`[[目标]]` 按这个顺序查找，用第一个匹配：

1. id：文件名，或 frontmatter 里的 `id`；
2. 别名：frontmatter 的 `aliases`；
3. 标题：任一语言版本的 `title`。

含 `/` 的目标是路径，例如 `[[notes/concepts/bm25]]`，按相对于知识库根目录的路径匹配，`.md` 可以省略。Markdown 链接先按路径找，再按文件名找。

比较时不区分大小写，空格和 `_` 当作 `-`，所以 `[[Vector Search]]`、`[[vector_search]]` 和 `[[vector-search]]` 指向同一篇笔记。别名或标题匹配到多篇笔记时，报告 `ambiguous-link` 警告，使用第一篇。用 `clio resolve <文字>` 可以查看一个名字解析到哪里。

链接在所有语言里按同样的规则解析，英文页面上的链接指向目标的英文版，见 [[multilingual]]。

## 为什么是这种写法

常见的链接写法有两种：Obsidian 的 `[[ ]]` 和标准 Markdown 链接。Clio 保留前者的写法，补上它缺的东西：

| | Obsidian `[[ ]]` | Markdown 链接 | Clio `[[ ]]` |
|---|---|---|---|
| 书写 | 短 | 长，要写相对路径 | 短 |
| 语言模型是否熟悉 | 熟悉 | 熟悉 | 同 Obsidian，多一个可选的 `关系::` 前缀 |
| 按什么解析 | 文件名 | 相对路径 | id、别名、标题 |
| 移动文件后 | 有效 | 失效 | 有效 |
| 关系类型 | 无 | 无 | 有，带声明好的反向标签 |
| 反向链接 | 编辑器里有 | 无 | 构建时算出，显示在网站上 |
| 小节和段落 | 支持 | 只有小节锚点 | 支持，构建时检查锚点是否存在 |
| 嵌入 | 支持 | 只能嵌入图片 | 支持，最多三层 |
| 在 GitHub 上可点击 | 否 | 是 | 否 |
| 目标不存在时 | 点击后新建 | 404 | 待写笔记，`clio check` 列出 |

选择 `[[ ]]` 的理由：

- **短。** 写作时不打断思路。语言模型在大量 Obsidian 笔记上见过这种写法，生成时很少出错。
- **兼容 Obsidian。** Clio 知识库可以直接用 Obsidian 打开和编辑；`clio init --adopt` 也能接管已有的 Obsidian 库。
- **按稳定的名字解析。** 链接指向 id、别名或标题，不指向路径，整理目录不会断链。
- **新增的部分都是可选的。** 不写 `关系::` 前缀时，它就是一个普通的 Obsidian 链接；写了，图谱里就多一条有方向、有名字的边。
- **未解析的链接有用。** 它们不是 404，而是一份待写清单，人和 Agent 都可以照着补。

保留 Markdown 链接，是因为有些文件需要在 GitHub 上直接阅读，例如仓库里的说明文档。
