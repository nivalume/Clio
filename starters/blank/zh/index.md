---
title: __TITLE_YAML__
summary: 知识库首页。
---
# __TITLE__

在这里写首页。新建笔记：

```bash
bunx clio new note "标题"
```

## 全部笔记

```clio-query
SORT updated DESC, title
LIMIT 50
SHOW table
FIELDS title, type, updated
```
