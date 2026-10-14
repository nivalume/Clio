---
title: Customizing
summary: Extend clio.toml with types, relations and folders, restyle with theme.css, add plugins in clio.config.ts, enable edit links.
tags: [config, theme, plugins]
rel:
  part-of: index
  see-also: [config, design]
updated: 2026-10-13
translation-of-hash: "7569e8854e0d"
---
# Customizing

You can fit a vault to your field without touching Clio's code: add note types and relations, adjust the folder mapping, change colours and fonts, and write render plugins for your own code blocks. This page goes task by task; [[config]] documents every key.

## An example: a paper type

Say the vault holds many paper notes, and you want them to have their own type, folder, template, required fields and an "implements" relation. Four steps.

:::steps
### Declare the type and its folder

```toml title="clio.toml"
[types.paper]
label = { zh = "论文", en = "Paper" }
required = ["summary", "year"]

[folders]
"notes/papers/" = "paper"
```

Notes under `notes/papers/` without a `type:` are now `paper`. A paper note without `summary` or `year` gets a `required-field` warning from `clio check`.

### Declare the relation

```toml title="clio.toml"
[[relations]]
name = "implements"
inverse = "implemented-by"
label = { zh = "实现", en = "implements" }
inverse_label = { zh = "被实现", en = "implemented by" }
```

Now you can write `[[implements::attention-is-all-you-need]]`, and the paper's page shows "implemented by ← …".

### Write a template

```markdown title="templates/paper.md"
---
title: "{{title}}"
summary: ""
year:
authors: []
status: seed
created: {{date}}
---
# {{title}}

## Findings

## Method

## Limitations
```

### Create notes and query them

```bash
clio new paper "Attention Is All You Need" --id attention-is-all-you-need
```

Custom fields work directly in queries:

```text
type = paper AND year >= 2020 SORT year DESC SHOW table FIELDS year, authors
```
:::

## clio.toml

### Types

`[types.<name>]` adds a type or changes a built-in one. `label` is the name shown in the interface, one per language; `required` lists the fields every note of that type must have. Naming a built-in type overrides only the keys you write, for example to require `raw` on every source note:

```toml
[types.source]
required = ["raw"]
```

Keep types few and stable. Add one only when notes are really written and used differently; when only the subject differs, use topic notes and tags instead; see [[vault-layout#Why folders by type]].

### Folders

`[folders]` maps folder prefixes to types and only affects notes without a `type:`. Your mappings are added on top of the built-in ones; when a file matches several prefixes, the longest wins. Folders only set the default type; moving files doesn't affect links.

```toml
[folders]
"notes/papers/" = "paper"
"meetings/" = "journal"
```

### Relations

Each `[[relations]]` entry declares a relation: `name`, `inverse`, `label`, `inverse_label`. For a relation that means the same in both directions, write `symmetric = true` and both sides show the same label:

```toml
[[relations]]
name = "alternative-to"
symmetric = true
label = { zh = "可替代", en = "alternative to" }
```

Keep relations few as well: each new one is one more choice for every writer and agent. The built-in relations are in [[linking#Typed relations]].

### Ignoring files

Paths in `[build] ignore` are not read as notes; they are added to the default ignore list. An entry without `*` matches that path and everything under it; an entry with `*` is a glob:

```toml
[build]
ignore = ["drafts/private", "**/*.excalidraw.md"]
```

## Theme

`theme/theme.css` loads after the default styles and overrides CSS variables. Write only the variables you change:

```css title="theme/theme.css"
:root {
  --paper: #f6f7f2;   /* page background */
  --cobalt: #0b7a75;  /* selection, current item, focus ring */
  --tomato: #ff9f43;  /* primary buttons */
}
```

Colour variables are named after their default colours (`--cobalt` is cobalt blue, `--tomato` is tomato red); give them other colours and they keep their role: `--cobalt` still marks the selection and the current item, `--tomato` is still the primary button. `--cobalt` has a separate, lighter value in the dark theme; to change that too, override it again as shown in [[config#Theme]]. Dark-theme overrides and the full list of variables are in [[config#Theme]], and the design behind them in [[design]].

Styles for the HTML that plugins produce go here too; see the next section.

## Plugins

`clio.config.ts` sits at the vault root and default-exports a config object; each plugin in `plugins` renders a kind of code block. Bun runs TypeScript directly, with no compile step. Plugins run at build time and their HTML is written into the static pages, so the browser never needs plugin code.

This plugin renders `timeline` code blocks as a timeline:

```ts title="clio.config.ts"
const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export default {
  plugins: [
    {
      name: "timeline",
      langs: ["timeline"],
      render(block) {
        const items = block.text
          .split("\n")
          .map((line) => line.split("|").map((s) => s.trim()))
          .filter(([date, text]) => date && text)
          .map(([date, text]) => `<li><time>${escape(date)}</time> ${escape(text)}</li>`);
        if (items.length === 0) return block.fallback;
        return `<ol class="timeline">${items.join("")}</ol>`;
      },
    },
  ],
};
```

In a note:

````markdown
```timeline
2026-04 | Karpathy publishes the LLM Wiki note
2026-10 | First edition of this handbook
```
````

And the styles, in `theme/theme.css`:

```css title="theme/theme.css"
.timeline { list-style: none; padding-left: 1rem; border-left: 2px solid var(--ink); }
.timeline li { margin: 0 0 0.5rem; }
.timeline time { font-family: var(--font-mono); background: var(--sun); padding: 0 0.25rem; }
```

Points to note:

- `langs` matches the code block's language; `kinds` matches the kind of block (`code`, `math`, `mermaid`, `chart`) and can replace a built-in renderer.
- `render(block, ctx)` returns an HTML string; returning `undefined` passes the block on to the next plugin or the built-in renderer. `block.fallback` is the HTML used when no plugin handles the block.
- Raw HTML in notes is dropped, but plugin output is not: a plugin is your own code and is trusted. So a plugin must escape any text that comes from a note, as `escape` does above.

Every field of `block` and `ctx` is listed in [[config#Plugins]].

## Edit this page

Once `clio.toml` names the repository, every page shows an "edit this page" link to its file in the repository:

```toml
[site]
repo = "https://github.com/you/kb"
edit_path = ""
```

If the vault isn't at the repository root, set `edit_path` to its subfolder. This handbook is configured like this:

```toml
[site]
repo = "https://github.com/nivalume/Clio"
edit_path = "docs/"
```
