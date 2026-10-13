---
title: Interface design
summary: The design language of the Clio site — palette, typography, the chat-window component, pixel avatars per note type, light and dark themes, and the accessibility choices.
tags: [design, theme]
rel:
  part-of: index
  see-also: [customizing, config]
updated: 2026-10-13
translation-of-hash: "5a31cfb57000"
---
# Interface design

The Clio site is brutalist with a Y2K web-chat flavour: cream paper, 2px black outlines, hard offset shadows, flat candy colours, and every panel drawn as a chat window. This page describes those elements and why they were chosen. To change the look, see [[customizing]] and [[config#Theme]].

## Why this style

Knowledge-base pages are dense: body text, outline, relations, backlinks and a local graph all appear at once. The style has three practical benefits here:

- **Clear boundaries.** Every panel has a full black outline and a title bar, so side-by-side panels separate at a glance without relying on subtle shades of grey.
- **Colour only encodes.** The background is a neutral paper tone; candy colours appear only where they mean something: note types, primary actions, selection, highlights.
- **High contrast.** Black on cream and black on candy colours read easily in both the light and the dark theme.

## Palette

| Variable | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#fffaef` | `#141111` | Page background |
| `--paper-2` | `#fbf1da` | `#1b1716` | Secondary background: sidebars, table headers, code blocks |
| `--card` | `#ffffff` | `#1f1a19` | Window bodies and cards |
| `--ink` | `#141111` | `#fffaef` | Text, outlines, hard shadows |
| `--ink-2` | `#3b3534` | `#e2d9c9` | Secondary text |
| `--muted` | `#6b6461` | `#aaa194` | Metadata |
| `--yellow` | `#ffd440` | same | Top bar, window icons, selection |
| `--pink` | `#fe7da8` | same | Primary action buttons, keyboard focus ring |
| `--cyan` | `#27ccf3` | same | Type colour |
| `--lime` | `#a9d877` | same | Type colour, success |
| `--lavender` | `#bbafe6` | same | Type colour |
| `--orange` | `#f8a16f` | same | Type colour |
| `--red` | `#f97264` | same | Errors |
| `--highlight` | `#ffe58f` | `#5b4a12` | `==highlight==` and search hits |

The dark theme swaps paper and ink and keeps the candy colours. Text and drawings on a candy colour always use dark ink (`--on-candy`, `#141111`), because light text on yellow or cyan lacks contrast. The full variable list is in [[config#Theme]].

## Typography

| Used for | Font | Fallback |
|---|---|---|
| Body, headings, interface | Space Grotesk | PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, then the system sans-serif |
| Code, metadata, tags, dates | Space Mono | The system monospace, with PingFang SC and Noto Sans SC for Chinese |

Space Grotesk is a geometric sans with wide, characterful letterforms that suit heavy outlines. Metadata (ids, types, dates, counts) is always set in the monospace, clearly apart from the body, like timestamps in a chat client. Both fonts cover Latin only; Chinese comes from the fallback fonts, so mixed text still shows Chinese in a familiar sans.

## Outlines, shadows and dots

- Outlines: every panel, button and input has a 2px solid ink border.
- Hard shadows: no blur, offset down and right, in three sizes: 2px, 4px and 6px (`--shadow-sm`, `--shadow`, `--shadow-lg`). A pressed button loses its shadow, as if pushed into the paper.
- Halftone shadow: important windows get a translucent grid of dots behind the hard shadow, offset about 15px, imitating print halftones.
- Corners: windows have a 10px radius; almost everything else is square.

## The chat-window component

Every panel in the interface (search, body, relations, graph, lint results) is the same window component with a fixed structure:

```text
┌───────────────────────────────────────────────────────┐
│ ┌──┐                                                  │
│ │ #│  Title  subtitle                 tools   ■ □ □   │  ← title bar
│ └──┘                                                  │
├───────────────────────────────────────────────────────┤
│  Tab 1 │ Tab 2 │ Tab 3                                │  ← optional tabs
├───────────────────────────────────────────────────────┤
│                                                       │
│  content                                              │
│                                                       │
└───────────────────────────────────────────────────────┘▓
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ← hard shadow
```

| Part | Description |
|---|---|
| Icon square | A 32px yellow square with a 2px ink border, holding `#` (like a chat channel) or a pixel avatar |
| Title and subtitle | Bold title; the subtitle is small monospace text for metadata such as an id or a count |
| Tools | Buttons on the right of the title bar, such as copy link or expand |
| Window dots | Three 8px squares, the first filled: ■□□. Pure decoration, hidden from screen readers |
| Tabs | A row under the title bar that switches views within one window, for example "Relations / Linked from / Local graph" |
| Body | White card background (dark in the dark theme), 18–20px padding |

One component everywhere means readers learn it once: the title bar says what this is, the body is the thing itself.

## Pixel avatars

Each note type has an 8×8 pixel avatar, like a user picture in a chat room: the type's candy colour as background with a simple shape drawn in ink pixels. Avatars appear next to note titles, in front of list items, in search results and in link previews.

An 8×8 grid is enough for distinguishable shapes and small enough to stay crisp in a 16px list row. The avatars are SVG drawn with `crispEdges`, so the pixels stay sharp at any zoom.

## Encoding note types

Type is the most important classification in this interface, so it is encoded three times:

| Encoding | Appears in |
|---|---|
| Candy colour | Avatar background, graph node fill, type labels in lists |
| Shape | Graph node shape, different for each type |
| Text | The type name ("Concept", "Source", …) in labels, legends and filters |

Colour alone fails readers with colour-vision deficiencies, black-and-white printouts and poor screens. With shape and text as well, the other two still work when one fails. The graph legend lists each type's colour and shape; see [[knowledge-graph#Graph view]].

## Light and dark

- On the first visit the site follows the operating system setting (`prefers-color-scheme`).
- Once the reader switches in the top bar, the choice is stored in the browser and the system setting is no longer followed; where local storage is unavailable (private mode, for example), the switch lasts for the current visit.
- Without JavaScript, pages still show the right theme for the system setting, because the dark variables live in a CSS media query.
- Code highlighting is generated at build time in a light and a dark variant, so switching themes needs no re-rendering.

## Accessibility

- **Type is not colour alone.** Colour, shape and text, as above.
- **Everything works from the keyboard.** All interactive elements are native buttons and links, and the tab order follows the visual order. Keyboard focus shows as a 3px pink outline, which does not appear on mouse clicks (`:focus-visible`).
- **Reduced motion.** When the system asks for reduced motion (`prefers-reduced-motion`), all transitions and animations are switched off.
- **Contrast.** Body text is ink on paper; anything on a candy colour uses dark ink.
- **Semantic structure.** Windows are `section`, `nav`, `aside` and similar elements, labelled by their titles through `aria-labelledby`; decorative dots and avatars are hidden from screen readers.
- **Readable without JavaScript.** Every note has complete static HTML; see [[architecture#Why a static site]].
