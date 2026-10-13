/**
 * A vault on disk: finds the root, lists note files, feeds them to the engine
 * and wraps the engine's commands in typed methods.
 */
import { Glob } from "bun";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { loadSettings, normaliseBase, type Settings } from "./config";
import { Engine } from "./engine";

export interface Diag {
  path: string;
  level: "error" | "warning" | "info";
  line: number;
  code: string;
  message: string;
}

export interface BuildSummary {
  notes: number;
  files: number;
  edges: number;
  wanted: number;
  clusters: number;
  errors: number;
  warnings: number;
  infos: number;
}

/** The directory holding clio.toml, searching upward from `start`; `start` itself if none is found. */
export function findRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, "clio.toml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(start);
    dir = up;
  }
}

/** Patterns are vault-relative: `raw` matches the folder and everything under it, `*` patterns are globs. */
export function ignored(path: string, patterns: string[]): boolean {
  if (path.split("/").includes("node_modules")) return true;
  return patterns.some((p) => {
    if (p.includes("*")) return new Glob(p).match(path);
    const dir = p.endsWith("/") ? p : `${p}/`;
    return path === p || path.startsWith(dir);
  });
}

/** Markdown files of the vault, as sorted vault-relative POSIX paths. */
export async function listNotes(root: string, ignore: string[]): Promise<string[]> {
  const out: string[] = [];
  for await (const f of new Glob("**/*.md").scan({ cwd: root, dot: false, onlyFiles: true })) {
    const path = f.split(sep).join("/");
    if (!ignored(path, ignore)) out.push(path);
  }
  return out.sort();
}

export class Vault {
  private constructor(
    readonly root: string,
    readonly settings: Settings,
    readonly engine: Engine,
    readonly files: string[],
  ) {}

  static async open(dir: string, overrides: { base?: string } = {}): Promise<Vault> {
    const root = findRoot(dir);
    const settings = await loadSettings(root);
    if (overrides.base) settings.engine.base = normaliseBase(overrides.base);
    const engine = await Engine.load();
    engine.command({ cmd: "config", config: settings.engine });
    const files = await listNotes(root, settings.ignore);
    for (const f of files) engine.upsert(f, await Bun.file(join(root, f)).text());
    return new Vault(root, settings, engine, files);
  }

  get locales(): string[] {
    return this.settings.engine.locales;
  }

  get defaultLang(): string {
    return this.locales[0] ?? "zh";
  }

  /** Re-read one file (or drop it if it was deleted). */
  async refresh(path: string): Promise<void> {
    const rel = relative(this.root, resolve(this.root, path)).split(sep).join("/");
    const file = Bun.file(join(this.root, rel));
    if (await file.exists()) this.engine.upsert(rel, await file.text());
    else this.engine.command({ cmd: "remove", path: rel });
  }

  build(): BuildSummary {
    return this.engine.command<BuildSummary>({ cmd: "build" });
  }

  lint(): Diag[] {
    return this.engine.command<Diag[]>({ cmd: "lint" });
  }

  page<T = PagePayload>(id: string, lang = this.defaultLang): T {
    return this.engine.command<T>({ cmd: "page", id, lang });
  }

  pageByNode<T = PagePayload>(node: number, lang: string): T {
    return this.engine.command<T>({ cmd: "page", node, lang });
  }

  pages(): { node: number; id: string; lang: string; url: string; fallback: boolean; path: string }[] {
    return this.engine.command({ cmd: "pages" });
  }

  site(lang = this.defaultLang): Record<string, any> {
    return this.engine.command({ cmd: "site", lang });
  }

  manifest(lang = this.defaultLang): Record<string, any> {
    return this.engine.command({ cmd: "manifest", lang });
  }

  graph(lang = this.defaultLang): GraphPayload {
    return this.engine.command({ cmd: "graph", lang });
  }

  search(q: string, limit = 20, lang = this.defaultLang): SearchHit[] {
    return this.engine.command({ cmd: "search", q, limit, lang });
  }

  context(id: string, hops = 1, lang = this.defaultLang): Record<string, any> {
    return this.engine.command({ cmd: "context", id, hops, lang });
  }

  resolve(target: string): { id: string; path: string } | null {
    return this.engine.command({ cmd: "resolve", target });
  }
}

export interface SearchHit {
  id: string;
  title: string;
  type: string;
  path: string;
  url: string;
  score: number;
  snippet: string;
}

export interface GraphPayload {
  nodes: { id: string; title: string; type: string; rank: number; cluster: number; url?: string; wanted?: boolean }[];
  edges: [number, number, number][];
  kinds: string[];
  clusters: { id: number; label: string; size: number }[];
}

export interface PagePayload {
  id: string;
  key: string;
  lang: string;
  noteLang: string;
  fallback: boolean;
  path: string;
  title: string;
  type: string;
  summary: string;
  tags: string[];
  aliases: string[];
  status: string | null;
  created: string | null;
  updated: string | null;
  reviewed: string | null;
  words: number;
  url: string;
  html: string;
  plugins: PluginBlock[];
  outline: { depth: number; text: string; slug: string }[];
  relations: { label: string; direction: "in" | "out"; items: RelatedItem[] }[];
  backlinks: RelatedItem[];
  local: { nodes: RelatedItem[]; edges: [number, number, string][] };
  translations: { lang: string; url: string; exists: boolean; title: string | null }[];
  rank: number;
  cluster: number;
  data: Record<string, unknown>;
  hash: string;
  sourceHash: string;
  translationOfHash: string | null;
  assets: string[];
  error?: string;
}

export interface RelatedItem {
  id: string;
  title: string;
  type: string;
  summary?: string;
  url: string;
  context?: string;
  wanted?: boolean;
}

export interface PluginBlock {
  kind: "code" | "math" | "mermaid" | "chart" | string;
  lang: string;
  title: string | null;
  highlight: number[];
  attrs: Record<string, string>;
  display: boolean;
  text: string;
  fallback: string;
  line: number;
}
