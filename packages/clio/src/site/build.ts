/**
 * `clio build`: the vault → a static site.
 *
 *   <out>/
 *     index.html, 404.html, llms.txt, .nojekyll
 *     [lang/]index.html graph.html explore.html tags.html tags/<tag>.html health.html wanted.html
 *     [lang/]n/<id>.html          one page per note per language (readable without JS)
 *     [lang/]n/<id>.md            the note's Markdown source, for agents
 *     _clio/<lang>/{site,manifest,graph,lint}.json   data for the app
 *     _app/                        the prebuilt app, KaTeX CSS, theme overrides
 *     _assets/                     images referenced by notes
 *     pagefind/                    full-text search index
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { Glob } from "bun";
import type { Diag, GraphPayload, PagePayload, Vault } from "../vault";
import { FAVICON, escape, langRedirect, list, page, ui } from "./html";
import { Renderer } from "./plugins";

export interface BuildOptions {
  out?: string;
  /** Skip the Pagefind index (faster rebuilds in `clio dev`). */
  search?: boolean;
  cache?: boolean;
  log?: (line: string) => void;
}

export interface BuildResult {
  out: string;
  pages: number;
  notes: number;
  assets: number;
  errors: number;
  warnings: number;
  ms: number;
  cache: { hits: number; misses: number };
}

const APP_DIR = resolve(dirname(new URL(import.meta.url).pathname), "../../web");
const PLUGIN = /B(\d+)/g;

interface SiteConf {
  title: string;
  /** Per language; `description` in clio.toml is a string or a table `{ zh = "…", en = "…" }`. */
  description: (lang: string) => string;
  base: string;
  locales: string[];
  repo: string | null;
  editPath: string;
  url: string | null;
  fonts: boolean;
}

function siteConf(vault: Vault): SiteConf {
  const raw = vault.settings.raw as Record<string, any>;
  const site = (raw.site ?? {}) as Record<string, any>;
  return {
    title: vault.settings.engine.title,
    description: (lang: string) => {
      const d = raw.description;
      if (d && typeof d === "object") return String(d[lang] ?? d[vault.locales[0]] ?? Object.values(d)[0] ?? "");
      return String(d ?? "");
    },
    base: vault.settings.engine.base,
    locales: vault.locales,
    repo: site.repo ? String(site.repo).replace(/\/$/, "") : null,
    editPath: site.edit_path ? String(site.edit_path).replace(/^\//, "").replace(/([^/])$/, "$1/") : "",
    url: site.url ? String(site.url).replace(/\/$/, "") : null,
    fonts: site.fonts !== false,
  };
}

function prefixOf(c: SiteConf, lang: string): string {
  return c.locales.length > 1 ? `${c.base}${lang}/` : c.base;
}

/** URL path → file under the output directory (`/zh/n/x` → `zh/n/x.html`, `/zh/` → `zh/index.html`). */
function fileOf(c: SiteConf, url: string, ext = ".html"): string {
  let p = url.startsWith(c.base) ? url.slice(c.base.length) : url.replace(/^\//, "");
  p = decodeURIComponent(p);
  if (p === "" || p.endsWith("/")) return `${p}index${ext}`;
  return `${p}${ext}`;
}

export async function buildSite(vault: Vault, opts: BuildOptions = {}): Promise<BuildResult> {
  const t0 = performance.now();
  const log = opts.log ?? (() => {});
  const c = siteConf(vault);
  const out = resolve(opts.out ?? join(vault.root, ".clio/site"));
  // The output directory is deleted first: never the vault itself, a folder above it, or another vault.
  if (!relative(out, vault.root).startsWith("..") || existsSync(join(out, "clio.toml"))) {
    throw new Error(`refusing to build into ${out}: it holds the vault`);
  }
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  // Synchronous writes with a cache of created folders: tens of thousands of small files.
  const made = new Set<string>();
  const pagesHash = new Bun.CryptoHasher("sha1");
  const write = async (path: string, data: string) => {
    const file = join(out, path);
    const dir = dirname(file);
    if (!made.has(dir)) {
      mkdirSync(dir, { recursive: true });
      made.add(dir);
    }
    writeFileSync(file, data);
    if (path.endsWith(".html")) {
      pagesHash.update(path);
      pagesHash.update(data);
    }
  };

  let mark = performance.now();
  const phase = (name: string) => {
    const now = performance.now();
    log(`${name}: ${((now - mark) / 1000).toFixed(1)} s`);
    mark = now;
  };
  const summary = vault.build();
  const diags: Diag[] = vault.lint();
  phase("vault");

  // Graph layout, warm-started from the previous build so positions stay put.
  const cacheDir = existsSync(join(vault.root, "node_modules")) ? join(vault.root, "node_modules/.cache/clio") : join(vault.root, ".clio/cache");
  const layoutFile = join(cacheDir, "layout.json");
  let previous: unknown = undefined;
  if (opts.cache !== false && existsSync(layoutFile)) {
    try {
      previous = await Bun.file(layoutFile).json();
    } catch {
      previous = undefined;
    }
  }
  const tl = performance.now();
  const layout = vault.engine.command<{ keys: string[]; x: number[]; y: number[] }>({ cmd: "layout", ...(previous ? { previous } : {}) });
  log(`layout: ${layout.keys.length} nodes in ${Math.round(performance.now() - tl)} ms${previous ? " (warm start)" : ""}`);
  mark = performance.now();
  if (opts.cache !== false) {
    await mkdir(cacheDir, { recursive: true });
    await Bun.write(layoutFile, JSON.stringify(layout));
  }
  const renderer = await Renderer.create(vault.root, { cache: opts.cache });
  if (renderer.userPlugins.length) log(`plugins: ${renderer.userPlugins.join(", ")}`);
  const theme = existsSync(join(vault.root, "theme/theme.css"));
  const generated = vault.settings.engine.today;
  const assets = new Set<string>();
  let pageCount = 0;

  const bootBase = (lang: string) => ({
    base: c.base,
    lang,
    locales: c.locales,
    prefix: prefixOf(c, lang),
    title: c.title,
    description: c.description(lang),
    repo: c.repo ?? undefined,
    editPath: c.editPath,
    types: vault.settings.engine.types.map((t) => t.name),
    app: `${c.base}_app/`,
    data: `${c.base}_clio/${lang}/`,
    pagefind: `${c.base}pagefind/`,
    generated,
  });
  const shell = (lang: string, title: string, description: string, boot: Record<string, unknown>, body: string, head = "") =>
    page({ lang, title, description, base: c.base, prefix: prefixOf(c, lang), siteTitle: c.title, boot, body, head, fonts: c.fonts, theme });

  const all = vault.pages();
  const source = async (path: string) => vault.text(path) ?? (await Bun.file(join(vault.root, path)).text());

  for (const lang of c.locales) {
    const t = ui(lang);
    const prefix = prefixOf(c, lang);
    const site = vault.site(lang) as Record<string, any>;
    const manifest = vault.manifest(lang);
    const graph: GraphPayload = vault.graph(lang);
    let index: { html: string; title: string } | null = null;

    // Note pages.
    for (const entry of all.filter((p) => p.lang === lang)) {
      const p = vault.pageByNode<PagePayload>(entry.node, lang);
      if (p.error) throw new Error(`${entry.path}: ${p.error}`);
      const rendered: string[] = [];
      for (const b of p.plugins) rendered.push(await renderer.render(b, { lang, page: { id: p.id, title: p.title, path: p.path } }));
      const html = p.html.replace(PLUGIN, (_m, i: string) => rendered[Number(i)] ?? "");
      for (const a of p.assets ?? []) assets.add(a);
      if (p.key === "index") index = { html, title: p.title };
      const { html: _h, plugins: _p, ...data } = p;
      const rels = p.relations
        .map((r) => `<h3>${r.direction === "out" ? "→" : "←"} ${escape(r.label)}</h3>${list(r.items)}`)
        .join("");
      const body = `<div data-pagefind-body><span hidden data-pagefind-meta="title">${escape(p.title)}</span><span hidden data-pagefind-meta="type">${escape(p.type)}</span>
<article id="clio-article" class="prose">${html}</article></div>
${rels ? `<section class="static-related"><h2>${t.relations}</h2>${rels}</section>` : ""}
${p.backlinks.length ? `<section class="static-related"><h2>${t.backlinks}</h2>${list(p.backlinks, true)}</section>` : ""}`;
      const head = [
        `<link rel="alternate" type="text/markdown" href="${escape(p.url)}.md">`,
        ...p.translations.filter((tr) => tr.exists && tr.lang !== lang).map((tr) => `<link rel="alternate" hreflang="${escape(tr.lang)}" href="${escape(tr.url)}">`),
        c.url ? `<link rel="canonical" href="${escape(c.url + p.url)}">` : "",
      ].join("");
      await write(fileOf(c, p.url), shell(lang, `${p.title} · ${c.title}`, p.summary, { ...bootBase(lang), route: "note", page: data }, body, head));
      await write(fileOf(c, p.url, ".md"), await source(p.path));
      pageCount++;
    }

    phase(`pages (${lang})`);
    // Data for the app.
    const wantedFrom = new Map<number, number[]>();
    for (const [s, tt] of graph.edges) if (graph.nodes[tt]?.wanted) wantedFrom.set(tt, [...(wantedFrom.get(tt) ?? []), s]);
    const wanted = [...wantedFrom.entries()]
      .map(([i, from]) => ({
        id: graph.nodes[i].id,
        title: graph.nodes[i].title,
        count: from.length,
        from: [...new Set(from)].map((s) => ({ id: graph.nodes[s].id, title: graph.nodes[s].title, url: graph.nodes[s].url ?? "" })),
      }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    const data = `_clio/${lang}/`;
    await write(`${data}site.json`, JSON.stringify({ ...site, description: c.description(lang), index, generated }));
    // The app derives note URLs from ids and shows one line of summary: ship only what it reads.
    const { url: _url, folder: _folder, words: _words, langs: _langs, cluster: _cluster, ...slim } = manifest;
    slim.summary = (manifest.summary as string[]).map((t) => {
      const chars = [...t];
      return chars.length > 100 ? `${chars.slice(0, 99).join("")}…` : t;
    });
    await write(`${data}manifest.json`, JSON.stringify(slim));
    await write(`${data}graph.json`, JSON.stringify({ ...graph, nodes: graph.nodes.map(({ url: _u, ...n }) => n) }));
    await write(`${data}lint.json`, JSON.stringify({ diags, wanted }));

    // View pages: the app renders them; the static HTML is a fallback.
    const hubs = (site.hubs ?? []) as { title: string; url: string; type: string; summary: string }[];
    const recent = (site.recent ?? []) as { title: string; url: string; type: string; summary: string }[];
    const homeBody = `${index ? `<article class="prose">${index.html}</article>` : `<h1>${escape(c.title)}</h1>${c.description(lang) ? `<p>${escape(c.description(lang))}</p>` : ""}`}
${hubs.length ? `<h2>${t.hubs}</h2>${list(hubs)}` : ""}${recent.length ? `<h2>${t.recent}</h2>${list(recent)}` : ""}`;
    const home = shell(lang, c.title, c.description(lang), { ...bootBase(lang), route: "home" }, homeBody);
    await write(fileOf(c, prefix), home);
    const view = (route: string, title: string, extra = "") =>
      shell(lang, `${title} · ${c.title}`, c.description(lang), { ...bootBase(lang), route }, `<h1>${escape(title)}</h1>${extra}<noscript><p>${t.noscript}</p></noscript>`);
    const notes = manifest.id.map((_: string, i: number) => ({ title: manifest.title[i], url: manifest.url[i], type: manifest.types[manifest.type[i]] }));
    await write(fileOf(c, `${prefix}graph`), view("graph", t.graph));
    await write(fileOf(c, `${prefix}explore`), view("explore", t.explore, notes.length <= 2000 ? list(notes) : ""));
    await write(fileOf(c, `${prefix}health`), view("health", t.health));
    await write(fileOf(c, `${prefix}wanted`), view("health", t.wanted));
    const tags = (site.tags ?? []) as [string, number][];
    await write(fileOf(c, `${prefix}tags`), view("tags", t.tags, list(tags.map(([tag, n]) => ({ title: `#${tag}`, url: `${prefix}tags/${tag.split("/").map(encodeURIComponent).join("/")}`, summary: String(n) })))));
    // A page per tag and per parent of a nested tag (`rust` for `rust/async`).
    const allTags = new Set<string>();
    for (const tg of manifest.tags as string[]) {
      const parts = tg.split("/");
      for (let k = 1; k <= parts.length; k++) allTags.add(parts.slice(0, k).join("/"));
    }
    for (const tag of [...allTags].sort()) {
      const tagged = notes.filter((_: unknown, i: number) => (manifest.tagIds[i] as number[]).some((x) => manifest.tags[x] === tag || manifest.tags[x].startsWith(`${tag}/`)));
      await write(
        fileOf(c, `${prefix}tags/${tag}`),
        shell(lang, `#${tag} · ${c.title}`, c.description(lang), { ...bootBase(lang), route: "tag", tag }, `<h1>#${escape(tag)}</h1>${list(tagged)}`),
      );
    }
    if (c.locales.length > 1 && lang === c.locales[0]) {
      await write("index.html", home.replace("</head>", `${langRedirect(c.base, c.locales)}\n</head>`));
    }
    if (lang === c.locales[0]) {
      await write("404.html", shell(lang, `404 · ${c.title}`, "", { ...bootBase(lang), route: "404" }, `<h1>404</h1><p>${t.notFound}</p><p><a href="${escape(prefix)}">${escape(c.title)}</a></p>`));
    }
  }

  // Images referenced by notes: vault-relative paths, or bare names found anywhere in the vault.
  let copied = 0;
  for (const a of [...assets].sort()) {
    let src = join(vault.root, a);
    if (!existsSync(src) && !a.includes("/")) {
      const found: string[] = [];
      for await (const f of new Glob(`**/${a}`).scan({ cwd: vault.root, onlyFiles: true })) {
        if (!f.split("/").some((part) => part === "node_modules" || part === ".clio" || part === ".git")) found.push(f);
      }
      found.sort();
      if (found[0]) src = join(vault.root, found[0]);
    }
    if (!existsSync(src)) {
      log(`missing image: ${a}`);
      continue;
    }
    await mkdir(dirname(join(out, "_assets", a)), { recursive: true });
    await cp(src, join(out, "_assets", a));
    copied++;
  }

  // The app, KaTeX styles and fonts, theme overrides.
  if (!existsSync(join(APP_DIR, "app.js"))) throw new Error(`the prebuilt app is missing (${APP_DIR}); run: bun run build:web`);
  await cp(APP_DIR, join(out, "_app"), { recursive: true });
  const require = createRequire(import.meta.url);
  const katexDir = dirname(require.resolve("katex/dist/katex.min.css"));
  await mkdir(join(out, "_app/katex"), { recursive: true });
  await cp(join(katexDir, "katex.min.css"), join(out, "_app/katex/katex.min.css"));
  await cp(join(katexDir, "fonts"), join(out, "_app/katex/fonts"), { recursive: true });
  if (existsSync(join(vault.root, "theme"))) await cp(join(vault.root, "theme"), join(out, "_app/theme"), { recursive: true });
  await write("_app/favicon.svg", FAVICON);
  await write(".nojekyll", "");

  // For agents: llms.txt lists every note (default language) with its Markdown mirror.
  const lang0 = c.locales[0];
  const m0 = vault.manifest(lang0) as Record<string, any>;
  const site0 = vault.site(lang0) as Record<string, any>;
  const byType = new Map<string, string[]>();
  m0.id.forEach((_: string, i: number) => {
    const type = m0.types[m0.type[i]];
    const line = `- [${m0.title[i]}](${m0.url[i]}.md)${m0.summary[i] ? `: ${m0.summary[i]}` : ""}`;
    byType.set(type, [...(byType.get(type) ?? []), line]);
  });
  const typeOrder = (site0.types as { name: string; label: string }[]).filter((ty) => byType.has(ty.name));
  const llms = [
    `# ${c.title}`,
    "",
    ...(c.description(lang0) ? [`> ${c.description(lang0)}`, ""] : []),
    `Every note is also available as Markdown: append \`.md\` to its URL. Data: \`${c.base}_clio/${lang0}/manifest.json\` (all notes), \`graph.json\` (links).`,
    "",
    ...typeOrder.flatMap((ty) => [`## ${ty.label}`, "", ...byType.get(ty.name)!, ""]),
  ].join("\n");
  await write("llms.txt", llms);

  if (c.url) {
    const urls = all.map((p) => `<url><loc>${escape(c.url + p.url)}</loc></url>`).join("\n");
    await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    // robots.txt only counts at the root of the domain.
    if (c.base === "/") await write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${c.url}/sitemap.xml\n`);
  }

  await renderer.save();
  phase("assets, app, llms.txt");

  // The search index depends only on the HTML pages; reuse the last one when no page changed.
  const searchKey = pagesHash.digest("hex");
  const searchCache = join(cacheDir, "pagefind");
  if (opts.search !== false && opts.cache !== false && existsSync(join(searchCache, searchKey, "pagefind.js"))) {
    await cp(join(searchCache, searchKey), join(out, "pagefind"), { recursive: true });
    phase("search index (unchanged, reused)");
  } else if (opts.search !== false) {
    const pagefind = await import("pagefind");
    const { index, errors } = await pagefind.createIndex({});
    if (!index) throw new Error(`pagefind: ${errors.join("; ")}`);
    const added = await index.addDirectory({ path: out });
    if (added.errors.length) throw new Error(`pagefind: ${added.errors.join("; ")}`);
    await index.writeFiles({ outputPath: join(out, "pagefind") });
    await pagefind.close();
    phase("search index");
    if (opts.cache !== false) {
      await rm(searchCache, { recursive: true, force: true });
      await cp(join(out, "pagefind"), join(searchCache, searchKey), { recursive: true });
    }
  }

  return {
    out,
    pages: pageCount,
    notes: summary.notes,
    assets: copied,
    errors: summary.errors,
    warnings: summary.warnings,
    ms: Math.round(performance.now() - t0),
    cache: { hits: renderer.hits, misses: renderer.misses },
  };
}
