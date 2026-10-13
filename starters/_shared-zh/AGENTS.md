# __TITLE__：给 Agent 的约定

这是一个 Clio 知识库。通用的工作流程在 Agent Skill `skills/clio/SKILL.md` 里；这份文件写这个知识库自己的约定，两者冲突时以这里为准。人可以随时修改这份文件。

## 布局

- `raw/` 存放原始资料，只读。不要修改、移动或删除其中的文件；`clio check` 会核对它们的 sha256。
- 笔记的类型由所在目录决定（见 `clio.toml` 的 `[folders]`），也可以在 frontmatter 里写 `type:`。
- `index.md` 是首页，目录由查询块生成，不要手工列笔记。
- `log.md` 只追加，不改旧记录。

## 写法

- 笔记 id 用英文 kebab-case（例如 `pratt-parser`），标题用中文。
- 每篇笔记一个主题。新建前先 `clio search`，已有笔记就更新它。
- 每篇笔记写一句 `summary`：写结论，不写“本文介绍”。
- 来自资料的论断都链接到来源：`[[source::来源id]]`，或引用具体段落 `[[来源id^块id]]`。
- 新结论和已有结论冲突时写 `[[contradicts::id]]`，两种说法都保留，不直接覆盖。

## 每次操作之后

- 运行 `clio check`，错误必须为 0；本次新增的 `wanted` 和 `missing-anchor` 要处理掉。
- 在 `log.md` 追加 `## [YYYY-MM-DD] 操作 | 标题`，下面列出新建和更新的笔记。
