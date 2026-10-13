---
title: __TITLE_YAML__
summary: Home page of the knowledge base.
---
# __TITLE__

Write the home page here. New note:

```bash
bunx clio new note "Title"
```

## All notes

```clio-query
SORT updated DESC, title
LIMIT 50
SHOW table
FIELDS title, type, updated
```
