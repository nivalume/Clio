---
title: 配置
summary: clio.toml 的每个键（类型、默认值、示例），theme.css 的 CSS 变量，以及 clio.config.ts 的插件接口。
tags: [config, reference]
rel:
  part-of: index
  see-also: [customizing, vault-layout]
updated: 2026-10-13
---
# 配置

一个知识库有三个配置位置：根目录的 `clio.toml`（站点、语言、类型、关系、构建），`theme/theme.css`（外观），`clio.config.ts`（渲染插件）。三个都可以没有，没有时用默认值。使用场景和步骤见 [[customizing]]。

## clio.toml 的位置

`clio` 从当前目录或 `--dir` 向上查找 `clio.toml`，它所在的目录就是知识库根目录。所有路径（`[folders]` 的键、`[build] ignore`）都相对于这个目录，用 `/` 分隔。文件格式是 TOML，由 Bun 内置的解析器读取。

一个空的 `clio.toml` 是合法的：每个键都有默认值。

## 顶层键

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | 字符串 | `"Clio"` | 网站标题，显示在顶栏、浏览器标签和 `llms.txt` |
| `description` | 字符串，或表：语言 → 字符串 | `""` | 网站说明，用于首页和 `<meta name="description">`。写成表时每种语言用自己的说明，缺少的语言用默认语言的 |
| `base` | 字符串 | `"/"` | 网站所在的 URL 路径，例如 `"/kb/"`。缺少开头或结尾的 `/` 时自动补上。`clio build --base` 优先于这里的值；生成的 GitHub Pages 工作流用它传入路径，所以 GitHub Pages 不需要改这里 |
| `locales` | 字符串数组 | `["zh"]` | 语言列表，第一项是默认语言。多于一项时 URL 带语言前缀 `/zh/n/<id>`、`/en/n/<id>` |
| `stale_days` | 整数 | `180` | `reviewed`（没有时用 `updated`）早于这么多天的笔记报告 `stale` 提示 |

```toml
title = "我的知识库"
description = "编译器、语言模型和读过的论文"
base = "/kb/"
locales = ["zh", "en"]
stale_days = 365
```

每种语言一个说明时：

```toml
description = { zh = "编译器、语言模型和读过的论文", en = "Compilers, language models and the papers I have read" }
```

多语言的文件命名和链接规则见 [[multilingual]]。

## site

`[site]` 设置网站上的仓库链接、网站的完整地址和字体。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `repo` | 字符串（URL） | 无 | 源码仓库地址。设置后每页显示「编辑此页」链接 |
| `edit_path` | 字符串 | `""` | 知识库在仓库里的子目录，例如 `"docs/"`；知识库就是仓库根目录时留空 |
| `url` | 字符串（URL） | 无 | 网站的绝对地址，只写协议和域名，例如 `"https://kb.example.com"`，路径部分由 `base` 提供。设置后构建生成 `sitemap.xml` 和 `robots.txt`，每个笔记页面带 `<link rel="canonical">` |
| `fonts` | 布尔 | `true` | 为 `false` 时不从 Google Fonts 加载 Space Grotesk 和 Space Mono，页面使用 `--font-text` 和 `--font-mono` 列表里本机已有的字体 |

```toml
[site]
repo = "https://github.com/you/kb"
edit_path = ""
url = "https://kb.example.com"
fonts = false
```

## types

`[types.<name>]` 新增一种笔记类型，或修改内置类型。按名字合并：写了内置类型的名字就只覆盖你写出的字段。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `label` | 表：语言 → 字符串 | 类型名 | 界面上显示的名字，每种语言一个 |
| `required` | 字符串数组 | `[]` | 这种类型的笔记必须有的 frontmatter 字段；缺少时报告 `required-field` 警告 |

```toml
[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary", "source"]

[types.source]          # 内置类型：只改必填字段
required = ["raw"]
```

内置类型和它们的默认目录：

| 类型 | 中文 | English | 默认目录 |
|---|---|---|---|
| `topic` | 主题 | Topic | `notes/topics/` |
| `concept` | 概念 | Concept | `notes/concepts/` |
| `entity` | 实体 | Entity | `notes/entities/` |
| `source` | 来源 | Source | `notes/sources/` |
| `question` | 问答 | Question | `notes/questions/` |
| `journal` | 日志 | Journal | `journal/` |
| `note` | 笔记 | Note | 其他所有位置 |

一篇笔记的类型按顺序取：frontmatter 的 `type`；`[folders]` 的映射；`note`。为什么按类型而不是按主题分目录，见 [[information-architecture]]。

## folders

`[folders]` 把目录前缀映射到类型，用于没有写 `type:` 的笔记。键是相对于根目录的路径前缀，以 `/` 结尾；值是类型名。你写的映射加在内置映射之上，同一个键以你的为准。一个文件匹配多个前缀时，最长的前缀生效。

```toml
[folders]
"notes/papers/" = "paper"
"guides/" = "guide"
```

目录只决定文件存放的位置和默认类型。笔记的 id 是全局的，把文件移到别的目录不会让链接失效。

## relations

`[[relations]]` 是一个表数组，每项声明一种关系。按 `name` 与内置关系合并，同名的覆盖内置定义。

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | 字符串 | 必填 | 关系名，在 `[[name::id]]` 和 frontmatter `rel:` 中使用 |
| `inverse` | 字符串 | 无 | 反方向的名字，例如 `used-by`。写 `[[inverse::id]]` 也被接受 |
| `symmetric` | 布尔 | `false` | 两个方向含义相同（如 `see-also`），目标页面用同一个标签 |
| `label` | 表：语言 → 字符串 | 关系名 | 源页面上显示的标签 |
| `inverse_label` | 表：语言 → 字符串 | 关系名 | 目标页面上显示的标签 |

```toml
[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }

[[relations]]
name = "alternative-to"
symmetric = true
label = { zh = "可替代", en = "alternative to" }
```

内置关系表见 [[linking]]。使用未声明的关系会报告 `unknown-relation` 警告。

## build

| 键 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `ignore` | 字符串数组 | `[]` | 不当作笔记读取的路径，加在默认列表之后 |

```toml
[build]
ignore = ["drafts/private", "**/*.excalidraw.md"]
```

不含 `*` 的项匹配这个路径本身以及它下面的所有文件；含 `*` 的项按 glob 匹配。默认忽略：`.clio`、`.git`、`node_modules`、`.obsidian`、`.trash`、`dist`、`raw`、`templates`、`theme`、`skills`、`.claude`、`.agents`、`.github`、`AGENTS.md`、`CLAUDE.md`、`README.md`、`log.md`。任何路径中含 `node_modules` 的文件也被忽略。

`raw/` 被忽略是指它不作为笔记读取；里面的文件仍然由 `clio check` 校验哈希，图片仍可以被嵌入。

## 完整示例

```toml
title = "我的知识库"
description = "编译器、语言模型和读过的论文"
base = "/"
locales = ["zh", "en"]
stale_days = 180

[site]
repo = "https://github.com/you/kb"
edit_path = ""
url = "https://kb.example.com"

[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary"]

[folders]
"notes/papers/" = "paper"

[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }

[build]
ignore = ["drafts/private"]
```

## 主题

`theme/theme.css` 在默认样式之后加载，用来覆盖 CSS 变量。只写你要改的变量：

```css title="theme/theme.css"
:root {
  --tomato: #c6f432;     /* 主要按钮改成荧光绿 */
  --font-text: "Inter", "PingFang SC", system-ui, sans-serif;
}

/* 深色主题：跟随系统时 */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #0d0f14;
  }
}

/* 深色主题：读者手动切换时 */
:root[data-theme="dark"] {
  --paper: #0d0f14;
}
```

深色主题有两种来源：系统偏好和读者在界面上的选择，所以深色的覆盖要写两处，如上例。只写在 `:root` 里的变量对两种主题都生效，除非默认样式在深色主题里另外定义了它（纸、墨、线条和钴蓝都是这样）。

| 变量 | 浅色默认 | 用途 |
|---|---|---|
| `--paper` | `#f2f0ea` | 页面背景（暖灰纸色） |
| `--paper-2` | `#e9e6dd` | 次级背景：侧栏、未选中的标签、元信息条 |
| `--card` | `#ffffff` | 卡片和面板内容区 |
| `--ink` | `#15151c` | 文字、描边、硬阴影 |
| `--ink-2` | `#3a3a47` | 次要文字 |
| `--muted` | `#61616f` | 元信息、占位文字 |
| `--line` | `#15151c` | 2px 描边 |
| `--line-soft` | `#dcd8cc` | 分隔线、点阵网格 |
| `--stone` | `#e6e3da` | 中性底色：行内代码、提示级别的检查结果 |
| `--on-candy` | `#15151c` | 类型色上的文字，深浅两种主题都是深色 |
| `--bar` / `--on-bar` | `#15151c` / `#f2f0ea` | 顶栏底色和文字 |
| `--cobalt` | `#3a5cff` | 主色：选中、当前项、焦点框、当前标签的色条 |
| `--cobalt-text` | `#2d4de6` | 纸色上的钴蓝文字 |
| `--cobalt-tint` | `#e6ebff` | 表头、选中行、代码链接的底色 |
| `--on-cobalt` | `#ffffff` | 钴蓝底上的文字（深色主题里是深色） |
| `--tomato` | `#ff5a3c` | 主要操作按钮；问题类型 |
| `--periwinkle` `--sky` `--lilac` `--sun` `--mint` `--pebble` | 见 [[design#色板]] | 类型色 |
| `--error` | `#d6293e` | 检查错误 |
| `--highlight` | `#fff0a8` | `==高亮==` 和搜索命中 |
| `--shadow-sm` / `--shadow` / `--shadow-lg` | 2 / 4 / 6px 偏移 | 硬阴影 |
| `--shadow-accent` | 4px 偏移 | 钴蓝硬阴影，用在链接预览上 |
| `--dots` / `--grid-dots` | 径向渐变 | 网点阴影和背景点阵 |
| `--font-text` | Space Grotesk，中文回退到苹方、思源黑体 | 正文字体 |
| `--font-mono` | Space Mono | 代码和元信息 |
| `--radius` | `8px` | 面板和标签的圆角 |
| `--topbar-h` | `60px` | 顶栏高度 |

这些变量背后的设计决定见 [[design]]。

## 插件

`clio.config.ts` 放在知识库根目录，默认导出一个配置对象（也可以用 `clio.config.js` 或 `clio.config.mjs`）。Bun 直接运行 TypeScript，不需要编译。插件用来渲染自定义的代码块：引擎把代码块、公式、Mermaid 和图表留成占位符，构建时 Bun 按 `plugins` 的顺序把每个占位符交给插件，插件返回 HTML。

一个插件认领一个块需要同时满足两个条件：没有写 `langs`，或者 `langs` 包含块的语言；没有写 `kinds`，或者 `kinds` 包含块的种类。认领的插件返回 `null` 或 `undefined` 时，块交给下一个插件；所有插件都不处理时，使用内置渲染。

```ts title="clio.config.ts 的类型"
export interface ClioConfig {
  plugins?: ClioPlugin[];
}

export interface ClioPlugin {
  /** 插件名，构建时打印在日志里 */
  name: string;
  /** 处理哪些代码块语言，例如 ["abc"]；不写表示不按语言筛选 */
  langs?: string[];
  /** 处理哪些占位符：code、math、mermaid、chart；不写表示全部 */
  kinds?: Array<"code" | "math" | "mermaid" | "chart">;
  /** 返回 HTML；返回 null 或 undefined 表示不处理，交给下一个插件或内置渲染 */
  render(block: PluginBlock, ctx: PluginContext): string | null | undefined | Promise<string | null | undefined>;
}

export interface PluginBlock {
  kind: "code" | "math" | "mermaid" | "chart";
  /** 代码块的语言，例如 "abc" */
  lang: string;
  /** 信息行里的 title="…" */
  title: string | null;
  /** 要高亮的行号（从 1 开始），来自 {2,4-6} */
  highlight: number[];
  /** 信息行里其余的 key=value */
  attrs: Record<string, unknown>;
  /** 公式是否为独立一行（$$…$$） */
  display: boolean;
  /** 代码块的原文 */
  text: string;
  /** 没有插件处理时使用的 HTML */
  fallback: string;
  /** 在源文件中的行号 */
  line: number;
}

export interface PluginContext {
  /** 当前页面的语言 */
  lang: string;
  /** 正在构建的笔记 */
  page: { id: string; title: string; path: string };
  /** 转义 HTML 特殊字符 */
  escape(s: string): string;
  /** 用内置的 Shiki 高亮一段代码，返回 HTML */
  highlight(code: string, lang: string): Promise<string>;
}
```

一个把 ```` ```csv ```` 代码块渲染成表格的例子：

```ts title="clio.config.ts"
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default {
  plugins: [
    {
      name: "csv-table",
      langs: ["csv"],
      render(block) {
        const [head, ...rows] = block.text.trim().split("\n").map((l) => l.split(","));
        const cells = (r: string[], tag: string) => r.map((c) => `<${tag}>${esc(c.trim())}</${tag}>`).join("");
        return `<table><thead><tr>${cells(head, "th")}</tr></thead><tbody>${rows
          .map((r) => `<tr>${cells(r, "td")}</tr>`)
          .join("")}</tbody></table>`;
      },
    },
  ],
};
```

插件在构建时运行，输出写进静态 HTML，浏览器端不需要插件代码。内置的 Shiki 代码高亮、KaTeX 公式和图表渲染走的是同一条路径，用户插件排在它们前面。内置渲染的结果按内容缓存（见 [[cli#clio build]]），插件的结果不缓存，每次构建都会调用插件。
