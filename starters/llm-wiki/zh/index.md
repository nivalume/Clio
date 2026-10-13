---
title: __TITLE_YAML__
summary: 按 Karpathy 的 LLM Wiki 模式组织的知识库：原始资料只读，笔记由人和 Agent 共同维护。
---
# __TITLE__

这个知识库按 Andrej Karpathy 的“LLM Wiki”模式组织：

- `raw/` 存放原始资料，只读；
- `notes/` 存放笔记，由你和 Agent 一起维护：每份资料一篇来源笔记，再加上概念、实体、主题和问答；
- `AGENTS.md` 写约定，`log.md` 记录每次操作。

起步内容是一个完整的例子：示例资料 [[one-idea-per-card]] 经过收录，写出了 [[atomic-note]]、[[zettelkasten]] 等笔记，挂在主题 [[note-taking]] 下；一个问题的回答归档成了 [[why-one-idea-per-note]]。看完可以删掉它们和 `raw/` 里的示例文件。

## 主题

```clio-query
type = topic
SORT title
SHOW cards
```

## 来源

```clio-query
type = source
SORT created DESC, title
LIMIT 20
SHOW table
FIELDS title, summary, created
```

## 问答

```clio-query
type = question
SORT updated DESC, title
```

## 常用命令

```bash
bunx clio new concept "标题"                  # 按模板新建笔记
bunx clio ingest <文件或网址> --title "标题"   # 收录资料
bunx clio search "关键词"
bunx clio check
bunx clio dev                                 # 本地预览
```
