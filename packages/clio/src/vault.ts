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

/** sha256 of a file as lowercase hex. */
export async function sha256File(path: string): Promise<string> {
  const h = new Bun.CryptoHasher("sha256");
  h.update(await Bun.file(path).arrayBuffer());
  return h.digest("hex");
}

/** `raw:` and `sha256:` from a note's frontmatter, if both are there. */
function rawRef(text: string): { raw: string; sha256: string; line: number } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m || !/^raw:/m.test(m[1])) return null;
  let fm: Record<string, unknown>;
  try {
    fm = (Bun.YAML.parse(m[1]) ?? {}) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof fm.raw !== "string" || typeof fm.sha256 !== "string") return null;
  const line = m[1].split(/\r?\n/).findIndex((l) => l.startsWith("raw:")) + 2;
  return { raw: fm.raw, sha256: fm.sha256.toLowerCase(), line };
}

export class Vault {
  /** Path → modification time of every note file the engine holds. */
  private mtimes = new Map<string, number>();
  private rawRefs = new Map<string, { raw: string; sha256: string; line: number }>();
  private rawCache: Diag[] | null = null;

  private constructor(
    readonly root: string,
    readonly settings: Settings,
    readonly engine: Engine,
  ) {}

  static async open(dir: string, overrides: { base?: string } = {}): Promise<Vault> {
    const root = findRoot(dir);
    const settings = await loadSettings(root);
    if (overrides.base) settings.engine.base = normaliseBase(overrides.base);
    const engine = await Engine.load();
    engine.command({ cmd: "config", config: settings.engine });
    const vault = new Vault(root, settings, engine);
    await vault.sync();
    return vault;
  }

  get locales(): string[] {
    return this.settings.engine.locales;
  }

  get defaultLang(): string {
    return this.locales[0] ?? "zh";
  }

  get files(): string[] {
    return [...this.mtimes.keys()].sort();
  }

  private load(path: string, text: string, mtime: number): void {
    this.engine.upsert(path, text);
    this.mtimes.set(path, mtime);
    const ref = rawRef(text);
    if (ref) this.rawRefs.set(path, ref);
    else this.rawRefs.delete(path);
    this.rawCache = null;
  }

  private drop(path: string): void {
    this.engine.command({ cmd: "remove", path });
    this.mtimes.delete(path);
    this.rawRefs.delete(path);
    this.rawCache = null;
  }

  /** Bring the engine up to date with the files on disk (new, changed and deleted notes). Returns the paths that changed. */
  async sync(): Promise<string[]> {
    const files = await listNotes(this.root, this.settings.ignore);
    const changed: string[] = [];
    const seen = new Set(files);
    for (const f of files) {
      const file = Bun.file(join(this.root, f));
      const mtime = file.lastModified;
      if (this.mtimes.get(f) === mtime) continue;
      this.load(f, await file.text(), mtime);
      changed.push(f);
    }
    for (const f of [...this.mtimes.keys()]) {
      if (!seen.has(f)) {
        this.drop(f);
        changed.push(f);
      }
    }
    // raw/ files may have changed even when no note did.
    this.rawCache = null;
    await this.checkRaw();
    return changed;
  }

  /** Re-read one file (or drop it if it was deleted). */
  async refresh(path: string): Promise<void> {
    const rel = relative(this.root, resolve(this.root, path)).split(sep).join("/");
    const file = Bun.file(join(this.root, rel));
    if (await file.exists()) this.load(rel, await file.text(), file.lastModified);
    else if (this.mtimes.has(rel)) this.drop(rel);
    await this.checkRaw();
  }

  /** Source notes whose file in raw/ is missing or no longer matches the recorded sha256. */
  async checkRaw(): Promise<Diag[]> {
    if (this.rawCache) return this.rawCache;
    const out: Diag[] = [];
    for (const [path, ref] of [...this.rawRefs.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const file = join(this.root, ref.raw);
      if (!existsSync(file)) {
        out.push({ path, level: "error", line: ref.line, code: "raw-modified", message: `\`${ref.raw}\` is missing` });
        continue;
      }
      const now = await sha256File(file);
      if (now !== ref.sha256) {
        out.push({ path, level: "error", line: ref.line, code: "raw-modified", message: `\`${ref.raw}\` changed after ingest (sha256 is now ${now.slice(0, 12)}…)` });
      }
    }
    this.rawCache = out;
    return out;
  }

  /** Engine summary plus the raw/ check. */
  build(): BuildSummary {
    const s = this.engine.command<BuildSummary>({ cmd: "build" });
    return { ...s, errors: s.errors + (this.rawCache?.length ?? 0) };
  }

  lint(): Diag[] {
    const diags = this.engine.command<Diag[]>({ cmd: "lint" });
    if (!this.rawCache?.length) return diags;
    return [...diags, ...this.rawCache].sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
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
