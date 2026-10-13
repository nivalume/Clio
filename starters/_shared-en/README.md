# __TITLE__

A [Clio](https://github.com/nivalume/Clio) knowledge base.

```bash
bun install          # installs Clio (Bun 1.2 or later)
bunx clio dev        # local preview with live reload: http://localhost:4321
bunx clio check      # check links and formatting
bunx clio build      # write the static site to .clio/site
```

- New note: `bunx clio new concept "Title"`, or create a Markdown file in the matching folder.
- Add a source: `bunx clio ingest <file or URL> --title "Title"`.
- Deploy: push to GitHub, then import into Vercel (`vercel.json` is included) or enable GitHub Pages
  (`.github/workflows/pages.yml` is included).
- Conventions for agents are in `AGENTS.md`; the workflows are in `skills/clio/SKILL.md`.

Handbook: https://clio-one.vercel.app/en
