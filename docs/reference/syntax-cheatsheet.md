---
title: 语法速查
summary: Clio Markdown 全部语法的速查表：左边是你写的，右边是你得到的，每行指向详细说明。
tags: [syntax, reference]
rel:
  part-of: index
  see-also: [writing-notes, linking, rich-content]
updated: 2026-10-13
---
# 语法速查

Clio Markdown 是 CommonMark 加上 GFM 和一组扩展。这一页把所有语法压缩成表格：「你写」是源码，「你得到」是渲染结果（能直接演示的就直接演示），「详见」指向讲解它的指南。

## 基本格式

| 你写 | 你得到 | 详见 |
|---|---|---|
| `**加粗**` `*斜体*` | **加粗** *斜体* | [[rich-content]] |
| `**加粗**，后面紧跟中文标点` | **加粗**，后面紧跟中文标点 | [[rich-content]] |
| `~~删除线~~` | ~~删除线~~ | [[rich-content]] |
| `==高亮==` | ==高亮== | [[rich-content]] |
| `` `行内代码` `` | `行内代码` | [[rich-content]] |
| `- [ ] 待办`、`- [x] 完成` | 带复选框的任务列表 | [[rich-content]] |
| `https://example.com` | 自动链接：https://example.com | [[rich-content]] |
| `正文[^1]` 和 `[^1]: 脚注内容` | 上标编号，脚注列在页面末尾 | [[rich-content]] |
| `<b>粗</b>`、`<script>` | 什么也不显示：原始 HTML 一律丢弃 | [[rich-content]] |

表格单元格里的竖线要写成 `\|`，否则会被当作列分隔，代码里也一样。

定义列表：术语单独一行，空一行，下一行以 `: ` 开头写定义。

```markdown
BM25

: 一种按词频和文档长度打分的检索函数。
```

## 链接

| 你写 | 你得到 | 详见 |
|---|---|---|
| `[[queries]]` | [[queries]]（显示目标的标题） | [[linking]] |
| `[[queries\|查询块]]` | [[queries\|查询块]] | [[linking]] |
| `[[cli#clio check]]` | [[cli#clio check]]（标题 › 章节） | [[linking]] |
| `[[syntax-cheatsheet^resolve-order]]` | [[syntax-cheatsheet^resolve-order]]（链接到一个块） | [[linking]] |
| `[[#嵌入]]` | [[#嵌入]]（本页的章节） | [[linking]] |
| `[文字](../guides/queries.md#锚点)` | 普通 Markdown 链接，同样计入反向链接和图谱 | [[linking]] |
| `[[还没写的笔记]]` | 指向「待写笔记」的链接，图谱中的幽灵节点，`wanted` 警告 | [[linking]] |

`[[目标]]` 的查找顺序：id → 别名 → 标题 → 路径，不区分大小写，空格和 `_` 当作 `-`。 ^resolve-order

下面是 [[linking]] 中「解析规则」一节的嵌入：

![[linking#解析规则]]

## 类型关系

| 你写 | 你得到 | 详见 |
|---|---|---|
| `[[depends-on::tokenizer]]` | 显示目标标题的链接；目标页面显示「被依赖 ← 本页」 | [[linking]] |
| `[[used-by::parser]]` | 也可以写反向名，效果等同于对方写 `depends-on` | [[linking]] |
| frontmatter `rel: { part-of: compilers }` | 同样的关系，不出现在正文里 | [[linking]] |
| frontmatter `rel: { see-also: [a, b] }` | 一个关系可以指向多篇 | [[linking]] |
| `[[implements::raft]]`（未声明） | 普通链接加 `unknown-relation` 警告 | [[config]] |

内置关系（源页面显示前一个标签，目标页面显示后一个）：

| 关系 | 反向 | 标签 |
|---|---|---|
| `depends-on` | `used-by` | 依赖 / 被依赖 |
| `part-of` | `has-part` | 属于 / 包含 |
| `supports` | `supported-by` | 支持 / 被支持 |
| `source` | `cited-by` | 来源 / 被引用 |
| `extends` | `extended-by` | 扩展 / 被扩展 |
| `example-of` | `has-example` | 示例 / 有示例 |
| `contradicts` | 对称 | 矛盾 |
| `see-also` | 对称 | 参见 |

为什么这样设计，见 [[knowledge-graph#反向标签]]。

## 嵌入

| 你写（单独成段） | 你得到 | 详见 |
|---|---|---|
| `![[pratt-parser]]` | 整篇笔记的正文嵌入在这里 | [[linking]] |
| `![[pratt-parser#结合性]]` | 只嵌入这一节 | [[linking]] |
| `![[pratt-parser^claim-1]]` | 只嵌入这一个块 | [[linking]] |
| `![[diagram.png]]` | 图片，在知识库任何位置查找这个文件名 | [[rich-content]] |
| `![[diagram.png\|示意图]]` | 带替代文字的图片 | [[rich-content]] |
| `![示意图](../assets/a.png)` | 相对路径的图片，构建时复制到网站 | [[rich-content]] |

嵌入最多套三层。A 嵌入 B、B 又嵌入 A 这样的循环会被截断，不会无限展开。 ^embed-limits

## 块 id 与标签

| 你写 | 你得到 | 详见 |
|---|---|---|
| 段落或列表项末尾加 `^claim-1`（前面有空格） | 这个块可以被 `[[id^claim-1]]` 链接和嵌入 | [[rich-content]] |
| 表格、代码块或引用之后单独一行 `^table-1` | 给前一个块加 id | [[rich-content]] |
| 正文中的 `#rust` | 标签 `rust` | [[writing-notes]] |
| 正文中的 `#rust/async` | 层级标签；按 `rust` 筛选时也会包含它 | [[writing-notes]] |
| frontmatter `tags: [rust, parser]` | 与正文标签合并 | [[writing-notes]] |

代码和链接里的 `#` 不算标签。标签至少要有一个非数字字符，所以 `#2024` 不是标签。 ^tag-rule

## Callout

| 你写 | 你得到 | 详见 |
|---|---|---|
| `> [!note] 标题` 后接 `> 内容` | 带标题和图标的提示框 | [[rich-content]] |
| `> [!warning]- 标题` | 默认折叠的提示框 | [[rich-content]] |
| `> [!tip]+ 标题` | 可折叠，默认展开 | [[rich-content]] |
| `> [!recipe]` | 自定义类型，默认样式，`callout-type` 提示 | [[rich-content]] |

已知类型：`note`、`abstract`/`summary`、`info`、`todo`、`tip`/`hint`、`important`、`success`、`question`、`warning`/`attention`、`caution`、`failure`、`danger`/`error`、`bug`、`example`、`quote`。

::::tabs
:::tab{title="你写"}
```markdown
> [!tip] 先搜索
> 新建笔记之前先 `clio search`，避免重复。
```
:::
:::tab{title="你得到"}
> [!tip] 先搜索
> 新建笔记之前先 `clio search`，避免重复。
:::
::::

## 指令

| 你写 | 你得到 | 详见 |
|---|---|---|
| `:::note 标题` … `:::` | 与 callout 相同的提示框 | [[rich-content]] |
| `:::warning{title="…" fold=closed}` | 默认折叠的提示框；`fold=open` 为可折叠、默认展开 | [[rich-content]] |
| `::::tabs` 内含多个 `:::tab{title="Rust"}` | 选项卡 | [[rich-content]] |
| `::::cards` 内含多个 `:::card{title="…"}` | 卡片网格 | [[rich-content]] |
| `:::steps` 包住有序列表或 `###` 标题 | 编号步骤 | [[rich-content]] |
| `:::details{title="展开" open}` | 可折叠块，`open` 表示默认展开 | [[rich-content]] |
| `::::columns` 内含 `:::column{width=2}` | 多栏布局，`width` 是相对宽度 | [[rich-content]] |
| `{title="…" .class #id key=value}` | 指令的属性 | [[rich-content]] |
| `:::timeline`（未知名字） | 普通块加 `unknown-directive` 警告 | [[rich-content]] |

嵌套时外层用更多冒号。信息行（`:::` 后面那部分）里不能出现 `:`。代码块里单独一行的 `:::` 会关闭外面的指令，所以示例里含 `:::` 时，外层要用 `::::`。

````markdown
::::tabs
:::tab{title="Rust"}
```rust
fn main() {}
```
:::
:::tab{title="TypeScript"}
```ts
export {};
```
:::
::::
````

## 代码、公式、图表

| 你写 | 你得到 | 详见 |
|---|---|---|
| ```` ```rust ```` | 构建时用 Shiki 高亮，浅色和深色各一套 | [[rich-content]] |
| ```` ```rust title="src/lib.rs" {2,4-6} ```` | 带文件名标题栏，第 2、4–6 行高亮 | [[rich-content]] |
| ```` ```diff ```` | 增删行着色 | [[rich-content]] |
| `$a^2+b^2=c^2$` | $a^2+b^2=c^2$ | [[rich-content]] |
| `$$` 独占一行包住公式 | 独立公式，构建时用 KaTeX 渲染 | [[rich-content]] |
| ```` ```mermaid ```` | Mermaid 图，在浏览器里渲染 | [[rich-content]] |
| ```` ```chart ```` 加 YAML 或 CSV | 构建时画成 SVG 的柱状图或折线图 | [[rich-content]] |

```chart
type: bar
title: 每周新增笔记
x: [第1周, 第2周, 第3周, 第4周]
series:
  - name: 概念
    data: [4, 7, 5, 9]
  - name: 来源
    data: [2, 3, 6, 4]
```

上面这张图的源码：

````markdown
```chart
type: bar
title: 每周新增笔记
x: [第1周, 第2周, 第3周, 第4周]
series:
  - name: 概念
    data: [4, 7, 5, 9]
  - name: 来源
    data: [2, 3, 6, 4]
```
````

`type` 可以是 `bar` 或 `line`。也可以用 CSV 代替 YAML，第一行是表头。

## 查询

| 你写 | 你得到 | 详见 |
|---|---|---|
| ```` ```clio-query ```` 内写 `type = concept` | 所有概念笔记的列表，按标题排序 | [[queries]] |
| `tag = rust AND NOT status = archived` | 条件可以用 AND、OR、NOT 和括号组合 | [[queries]] |
| `title ~ 解析` | `~` 是不区分大小写的子串匹配，`!~` 相反 | [[queries]] |
| `updated >= 2026-01-01` | 比较运算 `= != > < >= <=` | [[queries]] |
| `SORT updated DESC LIMIT 10` | 排序和数量 | [[queries]] |
| `SHOW table FIELDS type, updated` | 表格，指定列；`SHOW` 可选 `list`、`table`、`cards` | [[queries]] |

完整形式：`[WHERE] 条件 [SORT 字段 [ASC|DESC], …] [LIMIT n] [SHOW list|table|cards] [FIELDS a, b]`。字段：`id title type tag status lang path folder updated created reviewed words in out summary`，以及任何 frontmatter 键。`tag = rust` 也匹配 `rust/async`。

一个实际运行的例子，以表格列出本手册的参考页：

```clio-query
type = reference
SORT title
SHOW table
FIELDS summary
```

## Frontmatter

| 字段 | 含义 | 默认 |
|---|---|---|
| `id` | 全局唯一的标识，链接用它 | 文件名（不含 `.md`） |
| `title` | 标题 | 第一个一级标题，否则 id |
| `type` | 笔记类型 | 按目录映射，否则 `note` |
| `aliases` | 别名列表，链接可以用别名 | 无 |
| `tags` | 标签列表 | 无 |
| `status` | `seed`、`draft`、`stable`、`archived` | 无 |
| `summary` | 一句话摘要，显示在列表、预览和搜索结果里 | 无 |
| `created` `updated` `reviewed` | 日期 `YYYY-MM-DD`；`reviewed` 或 `updated` 过旧时报 `stale` | 无 |
| `rel` | 类型关系：关系名 → id 或 id 列表 | 无 |
| `lang` | 语言 | 由文件名决定 |
| `translation-of-hash` | 译文对应的原文哈希 | 无 |

其他键原样保留，可以在查询里使用。详见 [[writing-notes]]。

## 多语言

| 你写 | 你得到 | 详见 |
|---|---|---|
| 同一目录下的 `pratt-parser.en.md` | `pratt-parser` 的英文版本，URL 为 `/en/n/pratt-parser` | [[multilingual]] |
| frontmatter `lang: en` | 不按文件名、直接指定语言 | [[multilingual]] |
| 译文里的 `translation-of-hash: "41d07c3e9a55"` | 原文改动后报告 `translation-stale` | [[multilingual]] |
| 英文页里的 `[[pratt-parser]]` | 有英文版本时链接到英文版，否则链接到默认语言版本并标明回退 | [[multilingual]] |
