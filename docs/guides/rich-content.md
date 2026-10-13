---
title: 富内容
summary: 提示块、指令块（标签页、卡片、步骤、折叠、分栏）、代码、公式、Mermaid、图表、嵌入、块 id 和标签的写法，每种都附实际效果。
tags: [markdown, syntax]
rel:
  part-of: index
  see-also: [syntax-cheatsheet, queries]
updated: 2026-10-13
---
# 富内容

Clio 的 Markdown 是 CommonMark 加 GFM，再加一组扩展。这一页逐个介绍扩展语法：先给源码，紧接着是同一段源码在本页上的实际效果。全部写法的速查表见 [[syntax-cheatsheet]]。

## 基础语法

GFM 的功能都可以用：表格、任务列表、删除线、自动链接、脚注。另外支持 `==高亮==`、定义列表，以及紧挨中文标点的强调：`**加粗**，` 能正确加粗，不需要在星号外面加空格。

````markdown
- [x] 已完成的任务
- [ ] 未完成的任务

~~删除线~~、==高亮==、**加粗**，紧跟中文标点。脚注写在句末[^fn]。

[^fn]: 脚注内容显示在页面底部。

术语
: 定义写在冒号后面。
````

- [x] 已完成的任务
- [ ] 未完成的任务

~~删除线~~、==高亮==、**加粗**，紧跟中文标点。脚注写在句末[^fn]。

[^fn]: 脚注内容显示在页面底部。

术语
: 定义写在冒号后面。

表格单元格里的竖线要写成 `\|`，包括单元格里的行内代码和 `[[id|文字]]` 链接。

### 不支持原始 HTML

`<div>`、`<script>` 这样的 HTML 标签会被丢弃，不显示。笔记有一部分来自 Agent 从网页收录的内容，渲染器不放行任何 HTML，网页里的脚本和样式就不会被带进网站。需要的版式用下面的提示块和指令块实现。

## 提示块

引用块的第一行写 `[!类型]`，就成了提示块（callout），写法和 Obsidian 相同。类型后面是标题。

````markdown
> [!tip] 先写链接
> 链接到还不存在的笔记没有关系，它会出现在待写列表里。

> [!warning]- 折叠的警告
> 类型后面加 `-` 默认收起；加 `+` 默认展开，但可以收起。
````

> [!tip] 先写链接
> 链接到还不存在的笔记没有关系，它会出现在待写列表里。

> [!warning]- 折叠的警告
> 类型后面加 `-` 默认收起；加 `+` 默认展开，但可以收起。

内置的类型，同一行的名字是别名：

| 类型 | 用途 |
|---|---|
| `note` | 一般说明 |
| `abstract`、`summary` | 摘要 |
| `info` | 背景信息 |
| `todo` | 待办 |
| `tip`、`hint` | 技巧 |
| `important` | 重点 |
| `success` | 成功、完成 |
| `question` | 问题 |
| `warning`、`attention` | 警告 |
| `caution` | 小心 |
| `failure` | 失败 |
| `danger`、`error` | 危险、错误 |
| `bug` | 缺陷 |
| `example` | 例子 |
| `quote` | 引文 |

其他名字也可以用，例如 `[!decision]`，显示为默认样式的提示块，`clio check --all` 给出 `callout-type` 提示。

## 指令块

指令块用一行 `:::名字` 开始，用一行 `:::` 结束，包住一段内容：

```text
:::名字{属性} 标题
内容
:::
```

规则：

- 属性写在花括号里：`{title="标题" .类名 #id key=value}`。
- 嵌套时外层用更多的冒号：外层 `::::`，内层 `:::`。冒号一样多时，内层的结束行会提前结束外层。
- 开头那一行不能含 `:`，标题里需要冒号时换个写法。
- 不认识的名字照常显示内容，`clio check` 报告 `unknown-directive` 警告。

### 标签页

````markdown
::::tabs
:::tab{title="全局安装"}
```bash
bun add -g github:nivalume/Clio#v0.1.0
clio build
```
:::
:::tab{title="项目内安装"}
```bash
bun add github:nivalume/Clio#v0.1.0
bunx clio build
```
:::
::::
````

::::tabs
:::tab{title="全局安装"}
```bash
bun add -g github:nivalume/Clio#v0.1.0
clio build
```
:::
:::tab{title="项目内安装"}
```bash
bun add github:nivalume/Clio#v0.1.0
bunx clio build
```
:::
::::

### 卡片

````markdown
::::cards
:::card{title="写笔记"}
[[writing-notes]]：字段、类型、状态和模板。
:::
:::card{title="链接"}
[[linking]]：类型化关系、反向链接和待写笔记。
:::
:::card{title="查询"}
[[queries]]：生成自动更新的列表。
:::
::::
````

::::cards
:::card{title="写笔记"}
[[writing-notes]]：字段、类型、状态和模板。
:::
:::card{title="链接"}
[[linking]]：类型化关系、反向链接和待写笔记。
:::
:::card{title="查询"}
[[queries]]：生成自动更新的列表。
:::
::::

### 步骤

`steps` 把里面的有序列表或 `###` 标题显示成编号的步骤。

````markdown
:::steps
1. 安装 Bun 1.2 或更高版本。
2. 运行 `bun add -g github:nivalume/Clio#v0.1.0`。
3. 运行 `clio new site my-kb`。
:::
````

:::steps
1. 安装 Bun 1.2 或更高版本。
2. 运行 `bun add -g github:nivalume/Clio#v0.1.0`。
3. 运行 `clio new site my-kb`。
:::

用 `###` 标题时，每个标题和它下面的内容算一步，适合每一步都有代码块的教程，例如 [[getting-started]]。

### 折叠

````markdown
:::details{title="为什么 raw/ 是只读的"}
原件不变，笔记里的每条结论才能追溯到确定的版本。
:::

:::details{title="默认展开的折叠块" open}
加上 `open` 属性，页面打开时就是展开的。
:::
````

:::details{title="为什么 raw/ 是只读的"}
原件不变，笔记里的每条结论才能追溯到确定的版本。
:::

:::details{title="默认展开的折叠块" open}
加上 `open` 属性，页面打开时就是展开的。
:::

### 分栏

````markdown
::::columns
:::column{width=2}
宽栏。`width` 是相对宽度，这一栏占三分之二。
:::
:::column
窄栏，占三分之一。
:::
::::
````

::::columns
:::column{width=2}
宽栏。`width` 是相对宽度，这一栏占三分之二。
:::
:::column
窄栏，占三分之一。
:::
::::

### 提示指令

提示块也可以写成指令，名字和提示块的类型相同。内容很长、或者里面要嵌套其他指令时，这种写法比每行加 `>` 方便。

````markdown
:::note 指令形式的提示
内容不需要每行加 `>`。
:::

:::warning{title="默认收起" fold=closed}
`fold=closed` 相当于提示块的 `-`，`fold=open` 相当于 `+`。
:::
````

:::note 指令形式的提示
内容不需要每行加 `>`。
:::

:::warning{title="默认收起" fold=closed}
`fold=closed` 相当于提示块的 `-`，`fold=open` 相当于 `+`。
:::

### 代码块里的结束行

指令块里放一个含有 `:::` 行的代码块时，那一行会被当成指令的结束。外层改用更多的冒号即可：

````markdown
::::details{title="指令的写法"}
```text
:::note 标题
内容
:::
```
::::
````

::::details{title="指令的写法"}
```text
:::note 标题
内容
:::
```
::::

本页展示源码的代码块都放在指令块外面，也是这个原因。

## 代码

代码块的信息行写语言，可选 `title="…"` 和要高亮的行号：

````markdown
```rust title="src/rank.rs" {2,4-5}
pub fn rank(scores: &[f64]) -> Vec<usize> {
    let mut idx: Vec<usize> = (0..scores.len()).collect();
    idx.sort_by(|&a, &b| scores[b].total_cmp(&scores[a]));
    idx
}
```
````

```rust title="src/rank.rs" {2,4-5}
pub fn rank(scores: &[f64]) -> Vec<usize> {
    let mut idx: Vec<usize> = (0..scores.len()).collect();
    idx.sort_by(|&a, &b| scores[b].total_cmp(&scores[a]));
    idx
}
```

`title` 显示为标题栏，`{2,4-5}` 高亮第 2、4、5 行。语法高亮在构建时由 Shiki 完成，浅色和深色主题各生成一套，页面不需要加载高亮脚本。`diff` 语言显示增删的行：

```diff
- stale_days = 180
+ stale_days = 365
```

## 公式

`$…$` 写行内公式，`$$…$$` 写独立公式，构建时由 KaTeX 渲染成 HTML。Clio 用 PageRank 衡量笔记在图谱里的重要程度，它的公式是：

````markdown
阻尼系数 $d$ 一般取 $0.85$。

$$
PR(p_i) = \frac{1-d}{N} + d \sum_{p_j \in M(p_i)} \frac{PR(p_j)}{L(p_j)}
$$
````

阻尼系数 $d$ 一般取 $0.85$。

$$
PR(p_i) = \frac{1-d}{N} + d \sum_{p_j \in M(p_i)} \frac{PR(p_j)}{L(p_j)}
$$

$N$ 是笔记总数，$M(p_i)$ 是链接到 $p_i$ 的笔记集合，$L(p_j)$ 是 $p_j$ 发出的链接数。图谱算法见 [[knowledge-graph]]。

## Mermaid

`mermaid` 代码块在浏览器里渲染成图：

````markdown
```mermaid
flowchart LR
  A["写笔记"] --> B["clio check"]
  B --> C["clio build"]
  C --> D["部署"]
```
````

```mermaid
flowchart LR
  A["写笔记"] --> B["clio check"]
  B --> C["clio build"]
  C --> D["部署"]
```

## 图表

`chart` 代码块用 YAML 描述数据，构建时画成 SVG，页面不需要图表脚本。

````markdown
```chart
type: line
title: BM25 的词频饱和（k1 = 1.2）
x: [0, 1, 2, 3, 4, 5, 10]
series:
  - name: 词频得分
    data: [0, 1.0, 1.375, 1.571, 1.692, 1.774, 1.964]
```
````

```chart
type: line
title: BM25 的词频饱和（k1 = 1.2）
x: [0, 1, 2, 3, 4, 5, 10]
series:
  - name: 词频得分
    data: [0, 1.0, 1.375, 1.571, 1.692, 1.774, 1.964]
```

图中是 BM25 里一个词的得分随出现次数的变化，按 $tf \cdot (k_1 + 1) / (tf + k_1)$ 计算：出现一次得 1 分，十次也不到 2 分。`clio search` 用的就是 BM25。

| 键 | 值 |
|---|---|
| `type` | `bar`（柱状图）或 `line`（折线图） |
| `title` | 图表标题 |
| `x` | x 轴的类别或数值 |
| `series` | 系列列表，每项有 `name` 和与 `x` 等长的 `data` |

数据也可以写成带表头的 CSV，第一列是 x 轴，其余每列是一个系列：

````markdown
```chart
分类,页面
指南,10
参考,4
概念,6
```
````

## 嵌入

一个段落里只有 `![[id]]`、`![[id#小节]]` 或 `![[id^块]]` 时，把目标笔记、小节或段落嵌入当前页面，见 [[linking#嵌入]]。

图片有两种写法：

- `![[diagram.png]]` 或 `![[diagram.png|说明]]`：在整个知识库里按文件名查找图片，包括 `raw/`。
- `![说明](../assets/diagram.png)`：标准写法，路径相对于当前文件，构建时图片被复制到网站里。

支持 png、jpg、jpeg、gif、svg、webp 和 avif。

## 块 id

在段落或列表项末尾写一个空格和 `^块id`，或者在块后面单独一行写 `^块id`，这个块就可以被链接和嵌入。块 id 由英文字母、数字、`-` 和 `_` 组成。

````markdown
BM25 的词频得分有上限，同一个词重复得越多，每次增加的分数越少。 ^bm25-saturation

上面这段可以用 [[rich-content^bm25-saturation]] 链接。
````

BM25 的词频得分有上限，同一个词重复得越多，每次增加的分数越少。 ^bm25-saturation

上面这段可以用 [[rich-content^bm25-saturation]] 链接。

块 id 用来引用具体的论断：来源笔记给每条要点加块 id，概念笔记用 `[[来源id^块id]]` 精确引用其中一条，读者点过去就是那一段原话。

## 标签

正文里写 `#标签` 或 `#标签/子标签`，和 frontmatter 的 `tags` 合并。例如这一句带有 #markdown 标签。

识别规则：

- `#` 前面是行首、空格或标点，后面紧跟标签名；
- 标签名必须含非数字字符，`#2024` 不是标签；
- 代码、链接和标题里的 `#` 不算标签。

标签的用法见 [[writing-notes#标签]]。

## 查询

`clio-query` 代码块在构建时执行，把匹配的笔记列成列表、表格或卡片，见 [[queries]]。
