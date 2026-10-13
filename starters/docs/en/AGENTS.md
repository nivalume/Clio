# __TITLE__: conventions for agents

This is a documentation site written with Clio. The general workflows are in `skills/clio/SKILL.md`; this file holds
the conventions of these docs and wins where the two disagree.

## Page types

- `guides/`: one task per page, written as steps (`:::steps`) the reader can follow.
- `reference/`: every option, flag and field, in tables, without narrative.
- `concepts/`: why things are designed the way they are and how the parts fit.

## Writing

- Page ids are English kebab-case and match the file name.
- Every page has a one-sentence `summary` saying what the reader gets from it.
- Examples must run as written; keep commands and their output apart.
- Link pages with `[[id]]` and sections with `[[id#Section title]]`.
- After changing a page in the default language, run `clio translate-status`, update the translation and `--pin` it.

## After every change

- `clio check` reports no errors.
- Append `## [YYYY-MM-DD] edit | title` to `log.md`.
