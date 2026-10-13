/**
 * `clio.toml` → the engine configuration plus CLI-only settings.
 *
 * ```toml
 * title = "My knowledge base"
 * base = "/"                 # URL path the site is served from
 * locales = ["zh", "en"]     # first = default language
 * stale_days = 180
 *
 * [types.concept]            # extends or overrides the built-in types
 * label = { zh = "概念", en = "Concept" }
 * required = ["summary"]
 *
 * [folders]                  # folder → type for notes without `type:`
 * "notes/concepts/" = "concept"
 *
 * [[relations]]              # extends or overrides the built-in relations
 * name = "implements"
 * inverse = "implemented-by"
 * label = { zh = "实现", en = "implements" }
 * inverse_label = { zh = "被实现", en = "implemented by" }
 *
 * [build]
 * ignore = ["drafts/private"]   # added to the defaults
 * ```
 */

export interface TypeDef {
  name: string;
  label?: Record<string, string>;
  required?: string[];
}

export interface RelationDef {
  name: string;
  inverse?: string | null;
  symmetric?: boolean;
  label?: Record<string, string>;
  inverse_label?: Record<string, string>;
}

export interface EngineConfig {
  title: string;
  base: string;
  locales: string[];
  types: TypeDef[];
  folders: Record<string, string>;
  relations: RelationDef[];
  stale_days: number;
  today: string;
}

export interface Settings {
  engine: EngineConfig;
  ignore: string[];
  /** Absolute path of clio.toml, or null when the vault has none. */
  file: string | null;
  raw: Record<string, unknown>;
}

/** Paths never read as notes: build output, dependencies, raw sources, templates, agent files. */
export const DEFAULT_IGNORE = [
  ".clio",
  ".git",
  "node_modules",
  ".obsidian",
  ".trash",
  "dist",
  "raw",
  "templates",
  "theme",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "log.md",
];

const L = (zh: string, en: string) => ({ zh, en });

export const DEFAULT_TYPES: TypeDef[] = [
  { name: "topic", label: L("主题", "Topic") },
  { name: "concept", label: L("概念", "Concept") },
  { name: "entity", label: L("实体", "Entity") },
  { name: "source", label: L("来源", "Source") },
  { name: "question", label: L("问答", "Question") },
  { name: "journal", label: L("日志", "Journal") },
  { name: "note", label: L("笔记", "Note") },
];

export const DEFAULT_FOLDERS: Record<string, string> = {
  "notes/topics/": "topic",
  "notes/concepts/": "concept",
  "notes/entities/": "entity",
  "notes/sources/": "source",
  "notes/questions/": "question",
  "journal/": "journal",
};

const rel = (name: string, inverse: string | null, zh: string, en: string, zhInv: string, enInv: string, symmetric = false): RelationDef => ({
  name,
  inverse,
  symmetric,
  label: L(zh, en),
  inverse_label: L(zhInv, enInv),
});

export const DEFAULT_RELATIONS: RelationDef[] = [
  rel("depends-on", "used-by", "依赖", "depends on", "被依赖", "used by"),
  rel("part-of", "has-part", "属于", "part of", "包含", "has part"),
  rel("supports", "supported-by", "支持", "supports", "被支持", "supported by"),
  rel("source", "cited-by", "来源", "source", "被引用", "cited by"),
  rel("extends", "extended-by", "扩展", "extends", "被扩展", "extended by"),
  rel("example-of", "has-example", "示例", "example of", "有示例", "has example"),
  rel("contradicts", null, "矛盾", "contradicts", "矛盾", "contradicts", true),
  rel("see-also", null, "参见", "see also", "参见", "see also", true),
];

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function mergeByName<T extends { name: string }>(base: T[], extra: T[]): T[] {
  const out = base.map((b) => ({ ...b }));
  for (const e of extra) {
    const i = out.findIndex((b) => b.name === e.name);
    if (i >= 0) out[i] = { ...out[i], ...e };
    else out.push(e);
  }
  return out;
}

/** `kb` → `/kb/`; the site's URL path always starts and ends with a slash. */
export function normaliseBase(base: string): string {
  let b = base.trim() || "/";
  if (!b.startsWith("/")) b = `/${b}`;
  if (!b.endsWith("/")) b = `${b}/`;
  return b;
}

export async function loadSettings(root: string): Promise<Settings> {
  const file = `${root}/clio.toml`;
  const exists = await Bun.file(file).exists();
  const raw = (exists ? Bun.TOML.parse(await Bun.file(file).text()) : {}) as Record<string, any>;

  const types: TypeDef[] = Object.entries((raw.types ?? {}) as Record<string, Partial<TypeDef>>).map(([name, t]) => ({ ...t, name }));
  const relations = Array.isArray(raw.relations) ? (raw.relations as RelationDef[]) : [];
  const base = normaliseBase(String(raw.base ?? "/"));
  const locales = Array.isArray(raw.locales) && raw.locales.length ? raw.locales.map(String) : ["zh"];

  const engine: EngineConfig = {
    title: String(raw.title ?? "Clio"),
    base,
    locales,
    types: mergeByName(DEFAULT_TYPES, types),
    folders: { ...DEFAULT_FOLDERS, ...((raw.folders ?? {}) as Record<string, string>) },
    relations: mergeByName(DEFAULT_RELATIONS, relations),
    stale_days: Number(raw.stale_days ?? 180),
    today: process.env.CLIO_TODAY ?? today(),
  };
  const extra = Array.isArray(raw.build?.ignore) ? raw.build.ignore.map(String) : [];
  return { engine, ignore: [...DEFAULT_IGNORE, ...extra], file: exists ? file : null, raw };
}
