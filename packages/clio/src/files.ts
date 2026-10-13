/** Helpers for commands that write into a vault: ids, frontmatter edits, the log, folder lookup. */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Settings } from "./config";

export const VERSION = "0.1.0";

/** The Clio package root (holds starters/ and skills/). */
export const PACKAGE_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "../../..");

/** Title → id: lowercase, spaces and punctuation become `-`; letters of any script are kept. */
export function slugify(title: string): string {
  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/['’"“”`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const FM = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/;

/** Quote a YAML scalar when needed. */
export function yamlValue(v: string): string {
  if (v === "" || /^[\s\-?:,[\]{}#&*!|>'"%@`]|[:#]\s|\s$|^(true|false|null|yes|no|~)$|^[\d.+-]+$/i.test(v)) return JSON.stringify(v);
  return v;
}

/** Set top-level frontmatter keys (replacing existing lines, else appending); adds a frontmatter block if absent. */
export function setFrontmatter(text: string, values: Record<string, string | string[]>): string {
  const render = (k: string, v: string | string[]) => (Array.isArray(v) ? `${k}: [${v.map(yamlValue).join(", ")}]` : `${k}: ${yamlValue(v)}`);
  const m = FM.exec(text);
  if (!m) return `---\n${Object.entries(values).map(([k, v]) => render(k, v)).join("\n")}\n---\n\n${text}`;
  let fm = m[1];
  for (const [k, v] of Object.entries(values)) {
    const re = new RegExp(`^${k.replace(/[-]/g, "\\-")}:.*$`, "m");
    fm = re.test(fm) ? fm.replace(re, render(k, v)) : `${fm}\n${render(k, v)}`;
  }
  return `---\n${fm}\n---${m[2]}${text.slice(m[0].length)}`;
}

export function frontmatter(text: string): Record<string, unknown> {
  const m = FM.exec(text);
  if (!m) return {};
  try {
    return (Bun.YAML.parse(m[1]) ?? {}) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Where notes of a type live: the folder mapped to it in clio.toml, else `notes/`, else the vault root. */
export function folderFor(root: string, settings: Settings, type: string): string {
  const mapped = Object.entries(settings.engine.folders)
    .filter(([, t]) => t === type)
    .map(([f]) => f)
    .sort((a, b) => a.length - b.length);
  const existing = mapped.find((f) => existsSync(join(root, f)));
  if (existing ?? mapped[0]) return (existing ?? mapped[0]).replace(/\/?$/, "/");
  return existsSync(join(root, "notes")) ? "notes/" : "";
}

/** Append `## [date] op | title` (and optional list lines) to log.md, creating it if needed. */
export async function appendLog(root: string, date: string, op: string, title: string, lines: string[] = []): Promise<string> {
  const file = join(root, "log.md");
  const entry = `## [${date}] ${op} | ${title}`;
  const before = existsSync(file) ? await Bun.file(file).text() : "# Log\n";
  const sep = before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  await Bun.write(file, `${before}${sep}${entry}\n${lines.map((l) => `${l}\n`).join("")}`);
  return entry;
}

export async function writeNew(file: string, text: string): Promise<void> {
  mkdirSync(dirname(file), { recursive: true });
  await Bun.write(file, text);
}

/** Fill `{{name}}` placeholders. Unknown names are left as they are. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}
