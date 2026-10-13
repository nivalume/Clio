---
title: Performance
summary: Engine, build, layout and graph-view timings measured on a synthetic vault of 20,000 notes, and the design choices behind them.
tags: [performance, build]
rel:
  part-of: index
  see-also: [architecture, knowledge-graph]
updated: 2026-10-13
translation-of-hash: "1fae03b29fcb"
---
# Performance

The numbers on this page come from `bench/run.ts` in the repository, measured on a synthetic vault of 20,000 notes. The
engine's stages are described in [[architecture]] and the graph algorithms in [[knowledge-graph]].

## Setup

- **Vault**: `bun bench/gen.ts 20000 <dir>` generates 20,001 notes and 91,024 links, 714 of them to notes that do not
  exist (wanted notes). Notes belong to planted communities, link counts follow a power law, and the text mixes Chinese
  and English.
- **Machine**: 4-core Intel Xeon at 2.1 GHz, 16 GB of memory, Linux, Bun 1.4.2. The engine is the WebAssembly build,
  the same one users run.
- **Browser**: headless Chromium, 1440×900 window, no GPU acceleration.

## Results

| Measure | Result | Target |
|---|---|---|
| Engine: parse 20,001 notes | 8.8 s | |
| Engine: vault phase (links, relations, PageRank, clusters, lint, search index) | 4.3 s | |
| Engine: first layout (ForceAtlas2, 20,715 nodes including wanted notes) | 7.8 s | |
| Engine total | 20.9 s | ≤ 30 s |
| `clio build`, cold (no caches) | 70 s | ≤ 3 min |
| `clio build`, warm (caches, nothing changed) | 55 s | ≤ 60 s |
| Rebuild after adding one note | 84 s | |
| Layout change after adding one note | nodes move 0.12% of the graph's width on average; 1 node moves more than 2% | the rest stays put |
| Graph view: from opening the page to the drawn graph (local server, first load / cached) | 1.5 s / 1.0 s | |
| Graph view: panning and zooming | 69 frames/s on average; 95% of frames within 17.8 ms | ≥ 50 frames/s |

The rebuild after adding a note spends roughly: reading and parsing files 9 s, vault phase 3.8 s, layout (warm start)
2.3 s, writing the HTML pages 27 s, copying the app and writing `llms.txt` 2 s, Pagefind indexing 27 s. A warm build
with no changes skips the last step: when the HTML pages are identical to the last build, the previous search index is
reused.

The native and WebAssembly builds of the engine produce byte-identical output for the same vault, layout coordinates
included; a test checks this on a synthetic vault of 1,500 notes.

## Output size

| File | Size | gzipped |
|---|---|---|
| One note's HTML page (median) | 9.7 KB | |
| `_clio/zh/graph.json` (graph nodes, positions and edges) | 3.7 MB | 0.8 MB |
| `_clio/zh/manifest.json` (note list for Explore and title search) | 4.3 MB | 1.0 MB |
| `_clio/zh/site.json` (home page) | 0.33 MB | 0.08 MB |
| `pagefind/` (full-text index) | 89 MB | the browser downloads only the chunks a query needs |

The home page loads only `site.json`. `manifest.json` is fetched when Explore or the search box opens, `graph.json`
only on the graph page.

## What makes it fast

- **Each note is parsed once.** The engine keeps a content hash per file and skips unchanged text; `clio dev` and
  `clio mcp` re-read only files whose modification time changed.
- **Ordered data in the vault phase.** BTreeMaps and sorted arrays keep the output independent of hash-map order.
  PageRank runs 40 iterations; each Louvain pass does work proportional to the number of edges.
- **Barnes–Hut layout.** Repulsion is approximated with a quadtree, so each iteration is O(n log n). The next build
  starts from the cached positions with a capped speed: a new note settles next to its neighbours and the rest barely
  moves. When more than a fifth of the nodes are new, the layout runs in full instead.
- **Rendered blocks are cached by content.** Shiki, KaTeX and chart output is stored by content hash in
  `node_modules/.cache/clio`, so unchanged code blocks are not highlighted again.
- **The app fetches data on demand.** Note text is not bundled into the app. The home page, Explore and the graph each
  fetch their own JSON; a note's text, relations and local graph come with its page.
- **The graph is drawn on a canvas.** With many nodes on screen they are drawn as small squares batched by colour;
  while panning or zooming the previous frame is moved as an image and redrawn in full once the gesture pauses. Only
  high-PageRank nodes in view get labels; far out, cluster names are shown instead.

## Bottlenecks and next steps

- Most of a warm build goes to writing HTML pages (about 27 s, 10 s of it in the engine) and Pagefind indexing (about
  27 s). Pagefind has no incremental mode, so any page change rebuilds the whole index.
- The engine is single-threaded WebAssembly. The native build could run in parallel, but the default install does not
  require Rust; see [[roadmap]].
- At 100,000 notes, `manifest.json` should be split by type.

## Reproduce

```bash
bun bench/gen.ts 20000 /tmp/kb20k
bun bench/run.ts 20000 --dir /tmp/kb20k
```

`bench/run.ts` prints JSON with the engine, build and layout-stability numbers above. The graph frame rate was measured
by panning and zooming the graph page in a headless browser and recording the interval between frames.
