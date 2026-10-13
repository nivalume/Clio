# __TITLE__

一个 [Clio](https://github.com/nivalume/Clio) 知识库。

```bash
bun install          # 安装 Clio（需要 Bun 1.2 或更高版本）
bunx clio dev        # 本地预览，改动后自动刷新：http://localhost:4321
bunx clio check      # 检查链接和格式
bunx clio build      # 生成静态网站到 .clio/site
```

- 写笔记：`bunx clio new concept "标题"`，或直接在对应目录里新建 Markdown 文件。
- 收录资料：`bunx clio ingest <文件或网址> --title "标题"`。
- 部署：推到 GitHub 后用 Vercel 导入（已有 `vercel.json`），或启用 GitHub Pages（已有 `.github/workflows/pages.yml`）。
- 给 Agent 的约定在 `AGENTS.md`，工作流程在 `skills/clio/SKILL.md`。

手册：https://clio-one.vercel.app
