---
title: Interface design
summary: The design language of the Clio site — the cobalt and tomato palette, typography, folder-tab panels, pixel avatars per note type, light and dark themes, and the accessibility choices.
tags: [design, theme]
rel:
  part-of: index
  see-also: [customizing, config]
updated: 2026-10-14
translation-of-hash: "a2c7b3e047a7"
---
# Interface design

The Clio site is brutalist: warm grey paper, an ink top bar, 2px outlines, hard offset shadows, flat colour, and every panel drawn as a folder with tabs on top. The main colour is cobalt; the main actions are tomato red. This page describes those elements and why they were chosen. To change the look, see [[customizing]] and [[config#Theme]].

## Why this style

Knowledge base pages are dense: body, outline, relations, backlinks and a local graph all appear at once. This style has three practical benefits here:

- **Clear boundaries.** Each panel has a full ink outline and a tab, so panels side by side are easy to tell apart without relying on subtle shades of grey.
- **Colour only encodes.** The background is neutral paper and ink; colour appears only where it means something: cobalt for selection and the current place, tomato for the main action, the rest for note types.
- **High contrast.** Ink on paper and dark ink on the type colours read well in both the light and the dark theme; the ratios are under [[#Accessibility]].

## Palette

| Variable | Light | Dark | Used for |
|---|---|---|---|
| `--paper` | `#f2f0ea` | `#121218` | Page background |
| `--paper-2` | `#e9e6dd` | `#181820` | Secondary background: sidebars, inactive tabs, the metadata strip |
| `--card` | `#ffffff` | `#1c1c25` | Panel bodies and cards |
| `--ink` | `#15151c` | `#f2f0ea` | Text, outlines, hard shadows |
| `--ink-2` | `#3a3a47` | `#cfccd8` | Secondary text |
| `--muted` | `#61616f` | `#9a98a8` | Metadata |
| `--bar` | `#15151c` | `#0b0b10` | Top bar, ink in both themes |
| `--cobalt` | `#3a5cff` | `#7088ff` | Main colour: selection, current item, focus ring, the strip on the active tab |
| `--cobalt-tint` | `#e6ebff` | `#232a4d` | Table headers, selected rows |
| `--tomato` | `#ff5a3c` | same | The main action button on a screen; type colour: question |
| `--periwinkle` | `#8197ff` | same | Type colour: topic, guide |
| `--sky` | `#7fd4ff` | same | Type colour: concept |
| `--lilac` | `#b69cff` | same | Type colour: entity |
| `--sun` | `#ffc93d` | same | Type colour: source; lint warnings |
| `--mint` | `#3fcf9a` | same | Type colour: reference, journal |
| `--pebble` | `#dad6ca` | same | Type colour: plain note; neutral tags |
| `--error` | `#d6293e` | same | Lint errors, with white text |
| `--highlight` | `#fff0a8` | `#4a3d0a` | `==highlight==` and search hits |

The dark theme swaps paper and ink and lightens cobalt by one step; the type colours stay the same in both themes. Text and pixels on a type colour are always dark ink (`--on-candy`), because light text on these colours lacks contrast. Cobalt carries white text in the light theme and dark text in the dark theme (`--on-cobalt`). The error colour is kept apart from tomato: tomato is for buttons, the error colour only appears in lint results and on broken links. The full list of variables is in [[config#Theme]].

## Typography

| Used for | Font | Fallback |
|---|---|---|
| Body, headings, interface | Space Grotesk | PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, then the system sans-serif |
| Code, metadata, tags, dates | Space Mono | The system monospace, with PingFang SC and Noto Sans SC for Chinese |

Space Grotesk is a geometric sans with wide, characterful letterforms that suit heavy outlines. Metadata (ids, types, dates, counts) is always set in the monospace, clearly apart from the body. Both fonts cover Latin only; Chinese comes from the fallback fonts, so mixed text still shows Chinese in a familiar sans.

## Outlines, shadows and dots

- Outlines: every panel, button and input has a 2px solid ink border.
- Hard shadows: no blur, offset down and right, in three sizes: 2px, 4px and 6px (`--shadow-sm`, `--shadow`, `--shadow-lg`). A pressed button loses its shadow, as if pushed into the paper. Buttons on the ink top bar use a cobalt shadow, since an ink one would not show.
- Halftone shadow: important panels get a grid of dots behind the hard shadow, offset about 15px, imitating print halftones.
- Corners: panels and tabs have an 8px radius (`--radius`), tags and avatars 4–6px; buttons and inputs are square.

## Folder-tab panels

Every panel in the interface (search, note body, relations, graph, lint results) is the same component: a panel with one or more tabs along its top edge, like a folder.

```text
 +=======+ +-------+ +-------+
 | tab 1 | | tab 2 | | tab 3 |                 tools
 |       +-+-------+-+-------+----------------------+
 |                                                  |
 |  body                                            |
 |                                                  |
 +--------------------------------------------------+
```

| Part | Description |
|---|---|
| Tab | 2px outline, no bottom edge, 8px radius on the two top corners. The active tab has the card background and covers the panel's top border, so it joins the panel; the others have the `--paper-2` background and sit on the panel's top edge |
| Strip | A 4px strip along the top of the active tab. On a note page it is the note type's colour; elsewhere cobalt or the panel's own colour |
| Title tab | When there is only one tab, it is the panel's title: a 20px coloured square holding a symbol, the bold title, and a small monospace subtitle (a count, an id) |
| Tools | Buttons to the right of the tabs, such as open in graph or edit; at phone width they move below the tabs |
| Body | Card background, square top-left corner (where the tab joins), 8px radius on the other three, 6px hard shadow |

With several tabs, they switch the content of the same panel: "Note / Relations / Info" on a note page, "Graph / Table" on the graph page. The tabs are buttons in a `role="tablist"`; the left and right arrow keys move between them.

One component everywhere means readers learn it once: the tab says what this is and which view is showing, the body is the thing itself.

## Pixel avatars

Each note type has an 8×8 pixel avatar: the type's colour as background with a simple shape drawn in ink pixels. Avatars appear next to note titles, in front of list items, in search results and in link previews.

An 8×8 grid is enough for distinguishable shapes and small enough to stay crisp in a 16px list row. The avatars are SVG drawn with `crispEdges`, so the pixels stay sharp at any zoom.

## Encoding note types

Type is the most important classification in this interface, so it is encoded three times:

| Encoding | Appears in |
|---|---|
| Type colour | Avatar background, graph node fill, type labels in lists, the strip on the active tab of a note page |
| Shape | Graph node shape: stars for topics and guides, circles for concepts, squares for entities and references, triangles for sources, diamonds for questions, crosses for journals |
| Text | The type name ("Concept", "Source", …) in labels, legends and filters |

Colour alone fails readers with colour-vision deficiencies, black-and-white printouts and poor screens. With shape and text as well, the other two still work when one fails. The graph legend lists each type's colour and shape; see [[knowledge-graph#Graph view]].

## Light and dark

- On the first visit the site follows the operating system setting (`prefers-color-scheme`).
- Once the reader switches in the top bar, the choice is stored in the browser and the system setting is no longer followed; where local storage is unavailable (private mode, for example), the switch lasts for the current visit.
- Without JavaScript, pages still show the right theme for the system setting, because the dark variables live in a CSS media query.
- Code highlighting is generated at build time in a light and a dark variant, so switching themes needs no re-rendering.

## Accessibility

- **Type is not colour alone.** Colour, shape and text, as above.
- **Everything works from the keyboard.** All interactive elements are native buttons and links, and the tab order follows the visual order; panel tabs switch with the arrow keys. Keyboard focus shows as a 3px cobalt outline, which does not appear on mouse clicks (`:focus-visible`).
- **Reduced motion.** When the system asks for reduced motion (`prefers-reduced-motion`), all transitions and animations are switched off.
- **Contrast.** Measured with the WCAG formula, all text is above 4.5:1: ink on paper 15.9:1, metadata on the secondary background 4.9:1, dark ink on type colours at least 5.9:1 (tomato), white on cobalt 5.1:1, white on the error colour 5.0:1; in the dark theme, ink on card 14.8:1 and dark text on cobalt 6.2:1.
- **Semantic structure.** Panels are `section`, `nav`, `aside` and similar elements, labelled by their titles through `aria-labelledby`; decorative symbols and avatars are hidden from screen readers.
- **Readable without JavaScript.** Every note has complete static HTML; see [[architecture#Why a static site]].
