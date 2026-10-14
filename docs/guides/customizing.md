---
title: 定制
summary: 用 clio.toml 增加类型、关系和目录映射，用 theme.css 改外观，用 clio.config.ts 写插件，打开「编辑此页」。
tags: [config, theme, plugins]
rel:
  part-of: index
  see-also: [config, design]
updated: 2026-10-13
---
# 定制

不改 Clio 的代码，也能让知识库适应自己的领域：增加笔记类型和关系，调整目录映射，换颜色和字体，为自定义的代码块写渲染插件。本页按任务介绍这些做法，每个键的完整说明见 [[config]]。

## 一个例子：增加论文类型

假设知识库里有大量论文笔记，希望它们有自己的类型、目录、模板、必填字段和一种「实现」关系。四步完成。

:::steps
### 声明类型和目录

```toml title="clio.toml"
[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary", "year"]

[folders]
"notes/papers/" = "paper"
```

`notes/papers/` 下没写 `type:` 的笔记都是 `paper`。缺少 `summary` 或 `year` 的论文笔记，`clio check` 报告 `required-field` 警告。

### 声明关系

```toml title="clio.toml"
[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }
```

之后可以写 `[[implements::attention-is-all-you-need]]`，论文页面上显示「被实现 ← …」。

### 写模板

```markdown title="templates/paper.md"
---
title: "{{title}}"
summary: ""
year:
authors: []
status: seed
created: {{date}}
---
# {{title}}

## 结论

## 方法

## 局限
```

### 新建笔记并查询

```bash
clio new paper "Attention Is All You Need" --id attention-is-all-you-need
```

自定义字段可以直接用在查询里：

```text
type = paper AND year >= 2020 SORT year DESC SHOW table FIELDS year, authors
```
:::

## clio.toml

### 类型

`[types.<名字>]` 增加一种类型，或修改内置类型。`label` 是界面上显示的名字，每种语言一个；`required` 是必填字段。写内置类型的名字时只覆盖写出的字段，例如要求每篇来源笔记都有 `raw`：

```toml
[types.source]
required = ["raw"]
```

类型应当少而稳定。新类型只在写法和用途确实不同的时候才加；只是内容领域不同时，用主题笔记和标签，见 [[vault-layout#为什么按类型分目录]]。

### 目录

`[folders]` 把目录前缀映射到类型，只影响没写 `type:` 的笔记。你的映射加在内置映射之上；一个文件匹配多个前缀时，最长的前缀生效。目录只决定默认类型，移动文件不影响链接。

```toml
[folders]
"notes/papers/" = "paper"
"meetings/" = "journal"
```

### 关系

`[[relations]]` 每项声明一种关系：`name`、`inverse`、`label`、`inverse_label`。两个方向含义相同的关系写 `symmetric = true`，两边显示同一个标签：

```toml
[[relations]]
name = "alternative-to"
symmetric = true
label = { zh = "可替代", en = "alternative to" }
```

关系同样应当少：每增加一种，写的人和 Agent 就多一个选择要做。内置关系见 [[linking#类型化关系]]。

### 忽略

`[build] ignore` 里的路径不作为笔记读取，加在默认的忽略列表之后。不含 `*` 的项匹配这个路径和它下面的所有文件，含 `*` 的项按 glob 匹配：

```toml
[build]
ignore = ["drafts/private", "**/*.excalidraw.md"]
```

## 主题

`theme/theme.css` 在默认样式之后加载，用来覆盖 CSS 变量。只写要改的变量：

```css title="theme/theme.css"
:root {
  --paper: #f6f7f2;   /* 页面背景 */
  --cobalt: #0b7a75;  /* 选中、当前项、焦点框 */
  --tomato: #ff9f43;  /* 主要按钮 */
}
```

颜色变量按默认颜色命名（`--cobalt` 是钴蓝，`--tomato` 是番茄红），换成别的颜色后用途不变：`--cobalt` 仍然标出选中和当前项，`--tomato` 仍然是主要按钮。`--cobalt` 在深色主题里另有一个更亮的值，要连深色一起改，按 [[config#主题]] 的写法再覆盖一次。深色主题的写法和全部变量见 [[config#主题]]，这些变量背后的设计见 [[design]]。

插件生成的 HTML 也可以在这里加样式，见下一节。

## 插件

`clio.config.ts` 放在知识库根目录，默认导出一个配置对象，`plugins` 里每个插件负责渲染一类代码块。Bun 直接运行 TypeScript，不需要编译。插件在构建时运行，返回的 HTML 写进静态页面，浏览器里不需要插件代码。

下面这个插件把 `timeline` 代码块渲染成时间线：

```ts title="clio.config.ts"
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default {
  plugins: [
    {
      name: "timeline",
      langs: ["timeline"],
      render(block) {
        const items = block.text
          .split("\n")
          .map((line) => line.split("|").map((s) => s.trim()))
          .filter(([date, text]) => date && text)
          .map(([date, text]) => `<li><time>${escape(date)}</time> ${escape(text)}</li>`);
        if (items.length === 0) return block.fallback;
        return `<ol class="timeline">${items.join("")}</ol>`;
      },
    },
  ],
};
```

笔记里这样写：

````markdown
```timeline
2026-04 | Karpathy 发表 LLM Wiki 笔记
2026-10 | 本手册第一版
```
````

再在 `theme/theme.css` 里加上样式：

```css title="theme/theme.css"
.timeline { list-style: none; padding-left: 1rem; border-left: 2px solid var(--ink); }
.timeline li { margin: 0 0 0.5rem; }
.timeline time { font-family: var(--font-mono); background: var(--sun); padding: 0 0.25rem; }
```

要点：

- `langs` 按代码块的语言匹配；`kinds` 按块的种类匹配（`code`、`math`、`mermaid`、`chart`），可以用来替换内置的渲染。
- `render(block, ctx)` 返回 HTML 字符串；返回 `undefined` 表示不处理，交给下一个插件或内置渲染。`block.fallback` 是没有插件时使用的 HTML。
- 笔记里的原始 HTML 会被丢弃，插件的输出不会：插件是你自己写的代码，可以信任。所以插件里要自己转义来自笔记的文本，就像上面的 `escape`。

`block` 和 `ctx` 的全部字段见 [[config#插件]]。

## 编辑此页

在 `clio.toml` 里设置仓库地址后，每个页面都会显示「编辑此页」链接，指向这个文件在仓库里的位置：

```toml
[site]
repo = "https://github.com/you/kb"
edit_path = ""
```

知识库不在仓库根目录时，`edit_path` 写它所在的子目录。本手册就是这样配置的：

```toml
[site]
repo = "https://github.com/nivalume/Clio"
edit_path = "docs/"
```
