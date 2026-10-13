/**
 * Render plugins: turn the engine's placeholder blocks (code, math, mermaid,
 * chart, or any fenced block a user plugin claims) into HTML.
 *
 * Built-ins: Shiki for code (light and dark colours as CSS variables),
 * KaTeX for math, an SVG renderer for charts; mermaid is left for the browser.
 * User plugins come from `clio.config.ts` in the vault and run first:
 *
 * ```ts
 * export default {
 *   plugins: [{
 *     name: "abc",
 *     langs: ["abc"],                     // fenced-block languages it handles (none: any)
 *     render(block, ctx) { return `<div class="abc">${ctx.escape(block.text)}</div>`; },
 *   }],
 * };
 * ```
 *
 * `render` returns HTML, or null to pass the block on. Built-in results are
 * cached by content hash, so unchanged blocks are not highlighted again.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import katex from "katex";
import { bundledLanguages, createHighlighter, type Highlighter } from "shiki";
import type { PluginBlock } from "../vault";
import { renderChart } from "./chart";
import { escape } from "./html";

export interface PluginContext {
  /** Language of the page being built. */
  lang: string;
  page: { id: string; title: string; path: string };
  escape: (s: string) => string;
  /** Shiki highlighting, for plugins that show code. */
  highlight: (code: string, lang: string) => Promise<string>;
}

export interface Plugin {
  name: string;
  langs?: string[];
  kinds?: string[];
  render(block: PluginBlock, ctx: PluginContext): string | null | undefined | Promise<string | null | undefined>;
}

const THEMES = { light: "vitesse-light", dark: "vitesse-dark" } as const;
const CACHE_VERSION = "1";

export class Renderer {
  private highlighter: Promise<Highlighter> | null = null;
  private loaded = new Set<string>();
  private cache = new Map<string, string>();
  private used = new Map<string, string>();
  hits = 0;
  misses = 0;
  math = false;

  private constructor(
    private readonly plugins: Plugin[],
    private readonly cacheFile: string | null,
  ) {}

  static async create(root: string, opts: { cache?: boolean } = {}): Promise<Renderer> {
    const plugins: Plugin[] = [];
    for (const name of ["clio.config.ts", "clio.config.js", "clio.config.mjs"]) {
      const file = join(root, name);
      if (!existsSync(file)) continue;
      const mod = await import(file);
      const conf = mod.default ?? mod;
      for (const p of conf.plugins ?? []) {
        if (p && typeof p.render === "function") plugins.push(p as Plugin);
      }
      break;
    }
    const cacheDir = existsSync(join(root, "node_modules")) ? join(root, "node_modules/.cache/clio") : join(root, ".clio/cache");
    const cacheFile = opts.cache === false ? null : join(cacheDir, "render.json");
    const r = new Renderer(plugins, cacheFile);
    if (cacheFile && existsSync(cacheFile)) {
      try {
        const data = (await Bun.file(cacheFile).json()) as { version: string; entries: Record<string, string> };
        if (data.version === CACHE_VERSION) for (const [k, v] of Object.entries(data.entries)) r.cache.set(k, v);
      } catch {
        /* a broken cache is rebuilt */
      }
    }
    return r;
  }

  get userPlugins(): string[] {
    return this.plugins.map((p) => p.name);
  }

  /** Write the entries used by this build (unused ones are dropped). */
  async save(): Promise<void> {
    if (!this.cacheFile) return;
    mkdirSync(dirname(this.cacheFile), { recursive: true });
    await Bun.write(this.cacheFile, JSON.stringify({ version: CACHE_VERSION, entries: Object.fromEntries(this.used) }));
  }

  private shiki(): Promise<Highlighter> {
    this.highlighter ??= createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [] });
    return this.highlighter;
  }

  async highlight(code: string, lang: string, lines: number[] = []): Promise<string> {
    const hl = await this.shiki();
    let use = lang.toLowerCase();
    if (!(use in bundledLanguages)) use = "text";
    else if (!this.loaded.has(use)) {
      await hl.loadLanguage(use as keyof typeof bundledLanguages);
      this.loaded.add(use);
    }
    const marked = new Set(lines);
    const raw = code.split("\n");
    const diff = use === "diff";
    return hl.codeToHtml(code, {
      lang: use,
      themes: THEMES,
      defaultColor: false,
      transformers: [
        {
          line(node, line) {
            if (marked.has(line)) this.addClassToHast(node, "highlighted");
            if (diff) {
              const first = raw[line - 1]?.[0];
              if (first === "+") this.addClassToHast(node, ["diff", "add"]);
              else if (first === "-") this.addClassToHast(node, ["diff", "remove"]);
            }
          },
        },
      ],
    });
  }

  private key(b: PluginBlock): string {
    const h = new Bun.CryptoHasher("sha1");
    h.update(JSON.stringify([CACHE_VERSION, b.kind, b.lang, b.display, b.highlight, b.title, b.attrs, b.text]));
    return h.digest("hex");
  }

  async render(b: PluginBlock, ctx: Omit<PluginContext, "escape" | "highlight">): Promise<string> {
    if (b.kind === "math") this.math = true;
    for (const p of this.plugins) {
      // No `langs` means any language; no `kinds` means any kind.
      const claims = (!p.langs || p.langs.includes(b.lang)) && (!p.kinds || p.kinds.includes(b.kind));
      if (!claims) continue;
      const out = await p.render(b, { ...ctx, escape, highlight: (code, lang) => this.highlight(code, lang) });
      if (typeof out === "string") return out;
    }
    if (b.kind === "mermaid") return b.fallback;
    const key = this.key(b);
    const hit = this.cache.get(key);
    if (hit !== undefined) {
      this.hits++;
      this.used.set(key, hit);
      return hit;
    }
    this.misses++;
    let html: string;
    try {
      html = await this.builtin(b);
    } catch (e) {
      console.warn(`render ${b.kind} (${ctx.page.path}:${b.line}): ${e instanceof Error ? e.message : e}`);
      html = b.fallback;
    }
    this.cache.set(key, html);
    this.used.set(key, html);
    return html;
  }

  private async builtin(b: PluginBlock): Promise<string> {
    switch (b.kind) {
      case "math": {
        const html = katex.renderToString(b.text, { displayMode: b.display, throwOnError: false, output: "htmlAndMathml" });
        return b.display ? `<div class="math math-display">${html}</div>` : `<span class="math math-inline">${html}</span>`;
      }
      case "chart":
        return renderChart(b.text, b.title);
      case "code": {
        const code = b.text.replace(/\n$/, "");
        const pre = await this.highlight(code, b.lang || "text", b.highlight);
        const lang = b.lang ? `<span class="code__lang">${escape(b.lang)}</span>` : "";
        const title = b.title ? `<span class="code__title">${escape(b.title)}</span>` : "";
        return `<figure class="code"${b.lang ? ` data-lang="${escape(b.lang)}"` : ""}><figcaption class="code__bar">${title}${lang}</figcaption>${pre}</figure>`;
      }
      default:
        return b.fallback;
    }
  }
}
