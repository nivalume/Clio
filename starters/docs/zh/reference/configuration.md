---
title: 配置
summary: clio.toml 里常用的键。
tags: [config]
rel:
  part-of: index
updated: __DATE__
---
# 配置

站点设置写在项目根目录的 `clio.toml`。完整说明见 Clio 手册。

| 键 | 默认值 | 含义 |
|---|---|---|
| `title` | 目录名 | 网站标题 |
| `description` | 空 | 首页和搜索引擎显示的简介 |
| `base` | `"/"` | 网站所在的 URL 路径，例如 `"/docs/"` |
| `locales` | `["zh"]` | 语言列表，第一项是默认语言 |
| `stale_days` | `365` | 多少天没有更新算过期 |
| `[site] repo` | 无 | 仓库地址，用来生成“编辑此页”链接 |
| `[types.<名称>]` | | 新增页面类型 |
| `[folders]` | | 目录到页面类型的映射 |
