---
title: Multilingual vaults
summary: Languages, translation file names, link fallback, URLs, and tracking stale translations with translation-of-hash and clio translate-status.
tags: [i18n, translation]
rel:
  part-of: index
  see-also: [lint-codes, config]
updated: 2026-10-13
translation-of-hash: "18cb4ce5e4f3"
---
# Multilingual vaults

A Clio vault can hold versions of its notes in several languages. All translations of a note share one id, so links don't care about language, and each translation records which version of the original it was made from: when the original changes, Clio tells you which translations need to follow. This handbook is itself in Chinese and English.

## Configuring languages

List the languages in `clio.toml`; the first one is the default:

```toml
locales = ["zh", "en"]
```

With a single language (the default is `["zh"]`), URLs have no language prefix and the interface has no language switch.

## File names

A translation sits in the same folder as its original, with the language code in the file name:

| File | id | Language |
|---|---|---|
| `notes/concepts/bm25.md` | `bm25` | `zh` (default) |
| `notes/concepts/bm25.en.md` | `bm25` | `en` |

You can keep the file name and write `lang: en` in the frontmatter instead. The file name is easier to see: both versions sit next to each other in a file listing.

Each version has its own frontmatter: `title`, `summary` and `aliases` are in that language; `tags`, `rel`, `status` and so on usually match the original. A translation's title and aliases can be used in links too.

```bash
clio new concept "BM25" --id bm25 --lang en   # creates notes/concepts/bm25.en.md
```

If `bm25` already exists, this copies the original to `bm25.en.md` with the title from the command and the body left for you to translate.

A project created with `clio new site --locales zh,en` starts with translations of the starter notes, with `translation-of-hash` already set.

## Links and fallback

Links name an id, not a language. The same `[[bm25]]` goes to the Chinese version on a Chinese page and to the English version on an English page, and shows the title in that language.

If the target has no English version yet, the link still goes to `/en/n/bm25`, and that page shows the default-language content, marked as a fallback. So the English site is complete: every note has a page, even if some are not translated yet.

A section link matches the target's headings in that language: `[[bm25#原理]]` on the Chinese page, `[[bm25#How it works]]` on the English one. A wrong section name gives a `missing-anchor` warning.

## URLs

| Site | Note pages |
|---|---|
| Multilingual | `/zh/n/<id>`, `/en/n/<id>` |
| Single language | `/n/<id>` |

The `base` from `clio.toml` goes in front, so with `base = "/kb/"` a page is at `/kb/zh/n/<id>`.

On the first visit, the site root picks a version by the browser's language; after that, readers switch in the interface. Every page links to its other language versions.

## Translation workflow

Every file has a content hash: 12 hex digits computed over the whole file, frontmatter included. A translation records the hash of the original it was translated from in `translation-of-hash`:

```yaml
---
title: BM25
summary: A ranking function that scores keyword matches by term frequency and document length.
translation-of-hash: "9c1e0b7a4d2f"
---
```

Quote the hash: an all-digit hash without quotes would be read by YAML as a number.

Any later change to the original, even just its `updated` date, changes its hash, and `clio check` then reports the translation as `translation-stale`. That is deliberate: Clio doesn't judge whether a change affects the meaning; a person or an agent takes a look and decides.

:::steps
### Edit the original

Edit the default-language version as usual.

### Find the translations to update

```bash
clio translate-status
```

It lists the translations that need work in three groups: missing ones (`missing`), ones without a hash (`unpinned`) and stale ones (`stale`), with the hash to write for each. Add `--lang en` to see one language only. `clio show <id> --json` also shows a note's `hash` field.

### Update the translation

Bring the translation in line with the changes to the original. If a change doesn't affect the translation (a typo fix or a date), leave the body as it is.

### Pin the hash

```bash
clio translate-status --pin bm25
```

`--pin` writes the original's current hash into `translation-of-hash` of every translation of `bm25`; with `--lang en`, only into the English one. Separate several ids with commas. You can also write the hash from the list into `translation-of-hash` by hand.

### Check

```bash
clio check
```

With no `translation-stale` warnings left, every translation follows the current version of its original.
:::

## Lint codes involved

| Code | Level | Meaning |
|---|---|---|
| `translation-missing` | notice | A language has no version of this note yet |
| `translation-unpinned` | notice | A translation has no `translation-of-hash`; the notice gives the value to write |
| `translation-stale` | warning | The translation's `translation-of-hash` differs from the original's current hash |
| `missing-anchor` | warning | A section name in a link doesn't exist in that language's version of the target |

Notices only show with `--all`. [[lint-codes]] lists every code.

## Letting an agent translate

Translation suits an agent well: `clio translate-status --json` gives the list of work, the agent translates note by note and pins each hash with `clio translate-status --pin <id>`, and `clio check` confirms the result. The steps are in [[agents#Translate]].
