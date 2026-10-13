---
title: Pratt 解析器
type: concept
aliases: [pratt, 优先级爬升]
tags: [parser, "#compilers"]
rel:
  part-of: "[[expr-engine]]"
  depends-on: [tokenizer, lexer]
updated: 2026-10-13
---
# Pratt 解析器

优先级爬升的最小实现，见 [[recursive-descent]] 与 [[recursive-descent|递归下降]]。
它 [[depends-on::tokenizer]]，反驳了 [[contradicts::parser-generators-are-faster#基准]]。#parsing #2024 #编译/前端

这条结论被 [[benchmarks^run-3]] 支持。 ^claim-1

见 [标准链接](../topics/compilers.md#历史) 和 [外部](https://example.com)。

![[operator-table#优先级]]

![[diagram.png|示意图]]

![本地图片](../../assets/a.png)

> [!warning]- 小心 **右结合**
> `**` 是右结合的。
>
> 第二段。

> 普通引用，不是 callout。

::::tabs
:::tab{title="Rust"}
```rust title="src/parse.rs" {2}
fn main() {
    println!("hi");
}
```
:::
:::tab{title="说明"}
内联公式 $a^2+b^2=c^2$。
:::
::::

:::note 提示
指令形式的 callout。
:::

:::details{title="展开"}
隐藏内容
:::

:::unknown-thing
内容
:::

```mermaid
graph LR; A-->B
```

$$
\int_0^1 x\,dx
$$

```clio-query
type = concept AND tag = parser
```

- 列表项 ^item-a
- 第二项

| 列 | 说明 |
|---|---|
| a | 见 [[table-link]] |

<script>alert(1)</script>
