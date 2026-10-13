# __TITLE__: conventions for agents

This is a Clio knowledge base. The general workflows are in the agent skill `skills/clio/SKILL.md`; this file holds the
conventions of this particular vault and wins where the two disagree. People may edit it at any time.

## Layout

- `raw/` holds original sources and is read-only. Do not edit, move or delete files there; `clio check` verifies their sha256.
- A note's type comes from its folder (`[folders]` in `clio.toml`) or from `type:` in its frontmatter.
- `index.md` is the home page; its lists come from query blocks, so do not list notes by hand.
- `log.md` is append-only.

## Writing

- Ids are English kebab-case (`pratt-parser`).
- One subject per note. Run `clio search` before creating a note; update the existing one if there is one.
- Every note has a one-sentence `summary` that states the point.
- Every claim taken from a source links to it: `[[source::source-id]]`, or to the passage: `[[source-id^block-id]]`.
- When new material conflicts with a note, add `[[contradicts::id]]` and keep both views instead of overwriting.

## After every task

- `clio check` reports 0 errors; new `wanted` and `missing-anchor` warnings are dealt with.
- Append `## [YYYY-MM-DD] op | title` to `log.md`, listing the notes created and updated.
