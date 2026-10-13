/** `clio new site`, `clio init`, `clio new <type> <title>`. */
import { existsSync, readdirSync, statSync, symlinkSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { Glob } from "bun";
import { str, type Args } from "../args";
import { DEFAULT_IGNORE } from "../config";
import { appendLog, fill, folderFor, PACKAGE_ROOT, setFrontmatter, slugify, VERSION, writeNew } from "../files";
import { c, fail, print } from "../ui";
import { Vault } from "../vault";
import { pinHash, type TranslationRow } from "./translate";

const STARTERS = join(PACKAGE_ROOT, "starters");
const SKILL = join(PACKAGE_ROOT, "skills/clio");
const CONTENT_LANGS = ["zh", "en"];

function today(): string {
  if (process.env.CLIO_TODAY) return process.env.CLIO_TODAY;
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Starter files avoid dot names (package managers may drop them); restore them here. */
function outName(rel: string): string {
  return rel
    .split("/")
    .map((seg, i) => (seg === "gitignore" || seg === "gitkeep" || (i === 0 && seg === "github") ? `.${seg}` : seg))
    .join("/");
}

const TEXT = /\.(md|toml|json|ya?ml|css|txt|ts|js|html)$|(^|\/)(gitignore|gitkeep)$/;

async function copyTree(from: string, to: string, vars: Record<string, string>, skip: (rel: string) => boolean = () => false, rename: (rel: string) => string = (r) => r): Promise<string[]> {
  if (!existsSync(from)) return [];
  const written: string[] = [];
  const files: string[] = [];
  for await (const f of new Glob("**/*").scan({ cwd: from, onlyFiles: true, dot: true })) files.push(f.split("\\").join("/"));
  for (const rel of files.sort()) {
    if (skip(rel)) continue;
    const target = rename(outName(rel));
    const src = join(from, rel);
    const dest = join(to, target);
    await mkdir(dirname(dest), { recursive: true });
    if (TEXT.test(rel)) {
      let text = await Bun.file(src).text();
      for (const [k, v] of Object.entries(vars)) text = text.split(`__${k}__`).join(v);
      await Bun.write(dest, text);
    } else {
      await cp(src, dest);
    }
    written.push(target);
  }
  return written;
}

/** Copy the agent skill to skills/clio and link it where Claude Code and Codex look for skills. */
async function installSkill(root: string): Promise<string[]> {
  const done: string[] = [];
  const target = join(root, "skills/clio");
  if (!existsSync(join(target, "SKILL.md"))) {
    await cp(SKILL, target, { recursive: true });
    done.push("skills/clio/SKILL.md");
  }
  for (const dir of [".claude/skills", ".agents/skills"]) {
    const link = join(root, dir, "clio");
    if (existsSync(link)) continue;
    await mkdir(join(root, dir), { recursive: true });
    try {
      symlinkSync("../../skills/clio", link, "dir");
    } catch {
      await cp(SKILL, link, { recursive: true });
    }
    done.push(`${dir}/clio`);
  }
  return done;
}

function tomlArray(xs: string[]): string {
  return `[${xs.map((x) => JSON.stringify(x)).join(", ")}]`;
}

function packageName(title: string, dir: string): string {
  const ascii = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  return ascii(basename(dir)) || ascii(title) || "knowledge-base";
}

export async function newSite(args: Args): Promise<number> {
  const dirArg = args.positionals[1];
  if (!dirArg) fail("usage: clio new site <dir> [--starter llm-wiki|docs|blank] [--locales zh,en] [--title T]");
  const dir = resolve(dirArg);
  if (existsSync(dir) && readdirSync(dir).length) fail(`${dirArg} exists and is not empty`);
  const starter = str(args.flags, "starter", "llm-wiki")!;
  if (starter.startsWith("_") || !existsSync(join(STARTERS, starter, "clio.toml"))) {
    const names = readdirSync(STARTERS).filter((n) => existsSync(join(STARTERS, n, "clio.toml")));
    fail(`unknown starter "${starter}"; choose one of: ${names.join(", ")}`);
  }
  const locales = (str(args.flags, "locales", "zh") ?? "zh").split(",").map((s) => s.trim()).filter(Boolean);
  const lang = locales[0];
  const content = lang.startsWith("zh") ? "zh" : "en";
  const title = str(args.flags, "title") ?? basename(dir);
  const vars: Record<string, string> = {
    TITLE: title,
    TITLE_TOML: JSON.stringify(title),
    TITLE_YAML: JSON.stringify(title),
    NAME: packageName(title, dir),
    LOCALES: tomlArray(locales),
    LANG: lang,
    DATE: today(),
    CLIO_DEP: str(args.flags, "clio-dep") ?? `github:nivalume/Clio#v${VERSION}`,
    VERSION,
  };
  await mkdir(dir, { recursive: true });
  const isLangDir = (rel: string) => CONTENT_LANGS.includes(rel.split("/")[0]);
  await copyTree(join(STARTERS, "_shared"), dir, vars);
  await copyTree(join(STARTERS, `_shared-${content}`), dir, vars);
  await copyTree(join(STARTERS, starter), dir, vars, isLangDir);
  await copyTree(join(STARTERS, starter, content), dir, vars);
  // Other languages the starter has text for become translations: `x.md` → `x.en.md`.
  for (const other of locales.slice(1)) {
    const src = other.startsWith("zh") ? "zh" : other.startsWith("en") ? "en" : null;
    if (!src || src === content) continue;
    await copyTree(
      join(STARTERS, starter, src),
      dir,
      vars,
      (rel) => !rel.endsWith(".md") || /^(raw|templates|journal)\//.test(rel) || rel === "log.md" || rel === "AGENTS.md" || rel === "README.md",
      (rel) => rel.replace(/\.md$/, `.${other}.md`),
    );
  }
  // Source notes record the hash of their raw file.
  for await (const f of new Glob("**/*.md").scan({ cwd: dir, onlyFiles: true })) {
    const file = join(dir, f);
    const text = await Bun.file(file).text();
    if (!text.includes("__SHA256:")) continue;
    let out = text;
    for (const m of text.matchAll(/__SHA256:([^_\s]+)__/g)) {
      const h = new Bun.CryptoHasher("sha256");
      h.update(await Bun.file(join(dir, m[1])).arrayBuffer());
      out = out.split(m[0]).join(h.digest("hex"));
    }
    await Bun.write(file, out);
  }
  const skill = await installSkill(dir);
  // Pin the shipped translations to their sources.
  const vault = await Vault.open(dir);
  const rows = vault.engine.command<TranslationRow[]>({ cmd: "translations" });
  for (const r of rows) {
    for (const t of r.translations) {
      if (t.path && t.status === "unpinned") {
        const file = join(dir, t.path);
        await Bun.write(file, pinHash(await Bun.file(file).text(), r.hash));
      }
    }
  }
  const top = readdirSync(dir).sort();
  const templates = existsSync(join(dir, "templates")) ? readdirSync(join(dir, "templates")).length : 0;
  print(
    `${c.green("created")} ${relative(process.cwd(), dir) || "."}/ (starter: ${starter})`,
    `  ${top.filter((f) => statSync(join(dir, f)).isFile()).join("  ")}`,
    `  ${top.filter((f) => statSync(join(dir, f)).isDirectory() && !f.startsWith(".")).map((f) => `${f}/`).join("  ")}${templates ? `  (templates: ${templates})` : ""}`,
    `  agent skill: ${skill.join(", ")}`,
    `next: cd ${relative(process.cwd(), dir) || "."} && bun install && bunx clio dev`,
  );
  return 0;
}

const ADOPT_HINTS: [RegExp, string][] = [
  [/^(sources?|papers?|references?|literature|articles?|readings?|clippings?|books?)$/i, "source"],
  [/^(people|persons?|entities|entity|companies|organi[sz]ations?|orgs?)$/i, "entity"],
  [/^(mocs?|maps?|topics?|hubs?|index(es)?|areas?)$/i, "topic"],
  [/^(concepts?|ideas?|permanent|zettel|zettelkasten|evergreen|notes?)$/i, "concept"],
  [/^(daily|dailies|journal|journals|diary|daily notes)$/i, "journal"],
  [/^(questions?|q&a|qa|faq)$/i, "question"],
];

export async function init(args: Args): Promise<number> {
  const root = resolve(str(args.flags, "dir") ?? process.cwd());
  await mkdir(root, { recursive: true });
  const locales = (str(args.flags, "locales", "zh") ?? "zh").split(",").map((s) => s.trim()).filter(Boolean);
  const content = locales[0].startsWith("zh") ? "zh" : "en";
  const title = str(args.flags, "title") ?? basename(root);
  const wrote: string[] = [];

  let folders: [string, string][] = [];
  let left: string[] = [];
  if (args.flags.adopt) {
    let notes = 0;
    const perFolder = new Map<string, number>();
    for await (const f of new Glob("**/*.md").scan({ cwd: root, onlyFiles: true })) {
      const path = f.split("\\").join("/");
      if (DEFAULT_IGNORE.some((p) => path === p || path.startsWith(`${p}/`))) continue;
      notes++;
      const top = path.includes("/") ? path.split("/")[0] : "";
      if (top) perFolder.set(top, (perFolder.get(top) ?? 0) + 1);
    }
    for (const [folder] of [...perFolder.entries()].sort((a, b) => b[1] - a[1])) {
      const hint = ADOPT_HINTS.find(([re]) => re.test(folder));
      if (hint) folders.push([`${folder}/`, hint[1]]);
      else left.push(folder);
    }
    print(`found ${notes.toLocaleString("en")} notes in ${perFolder.size} folders`);
  }

  if (!existsSync(join(root, "clio.toml"))) {
    const lines = [
      `title = ${JSON.stringify(title)}`,
      `base = "/"`,
      `locales = ${tomlArray(locales)}`,
      `stale_days = 180`,
      "",
    ];
    if (folders.length || left.length) {
      lines.push("# Folder → note type for notes without `type:` in their frontmatter.", "[folders]");
      const width = Math.max(...folders.map(([f]) => JSON.stringify(f).length), 0);
      for (const [f, t] of folders) lines.push(`${JSON.stringify(f).padEnd(width)} = ${JSON.stringify(t)}`);
      for (const f of left) lines.push(`# ${JSON.stringify(`${f}/`)} = "note"`);
      lines.push("");
    }
    await Bun.write(join(root, "clio.toml"), lines.join("\n"));
    wrote.push("clio.toml");
    if (args.flags.adopt) {
      print(`wrote clio.toml with [folders]:`, ...folders.map(([f, t]) => `  ${JSON.stringify(f)} = ${JSON.stringify(t)}`));
      if (left.length) print(`  (${left.length} folders left as type note; edit clio.toml to map them)`);
    }
  }
  for (const name of ["AGENTS.md", "CLAUDE.md"]) {
    if (existsSync(join(root, name))) continue;
    const src = existsSync(join(STARTERS, `_shared-${content}`, name)) ? join(STARTERS, `_shared-${content}`, name) : join(STARTERS, "_shared", name);
    await Bun.write(join(root, name), (await Bun.file(src).text()).split("__TITLE__").join(title));
    wrote.push(name);
  }
  const skill = await installSkill(root);
  if (skill.length) print(`installed agent skill: ${skill.join(", ")}`);
  if (wrote.length) print(`${c.green("wrote")} ${wrote.join(", ")}`);
  print("run: clio check");
  return 0;
}

const FALLBACK_TEMPLATE = `---
title: {{title}}
type: {{type}}
summary:
tags: []
status: seed
created: {{date}}
updated: {{date}}
---
# {{title}}

`;

export async function newNote(vault: Vault, args: Args): Promise<number> {
  const [type, ...titleParts] = args.positionals;
  const title = titleParts.join(" ").trim();
  if (!type || !title) fail('usage: clio new <type> "<title>" [--id ID] [--tags a,b] [--lang en]');
  const known = vault.settings.engine.types.map((t) => t.name);
  if (!known.includes(type)) fail(`unknown type "${type}"; types: ${known.join(", ")}`);
  const lang = str(args.flags, "lang");
  const id = str(args.flags, "id") ?? slugify(title);
  if (!id) fail("could not make an id from the title; pass --id");
  const existing = vault.resolve(id);

  // A translation of an existing note: start from its text.
  if (lang && lang !== vault.defaultLang && existing && existing.id === id) {
    const srcPath = existing.path;
    const target = srcPath.replace(/(\.[a-z]{2}(-[A-Za-z]+)?)?\.md$/, `.${lang}.md`);
    if (existsSync(join(vault.root, target))) fail(`${target} already exists`);
    const text = await Bun.file(join(vault.root, srcPath)).text();
    await writeNew(join(vault.root, target), setFrontmatter(text, { title }));
    print(`${c.green("created")} ${target} (translation of ${srcPath}; pin it with clio translate-status --pin ${id} when done)`);
    return 0;
  }
  if (existing && existing.id.toLowerCase() === id.toLowerCase()) fail(`id "${id}" is taken by ${existing.path}`);
  const folder = folderFor(vault.root, vault.settings, type);
  const path = `${folder}${id}${lang && lang !== vault.defaultLang ? `.${lang}` : ""}.md`;
  if (existsSync(join(vault.root, path))) fail(`${path} already exists`);
  const tplFile = join(vault.root, "templates", `${type}.md`);
  const tpl = existsSync(tplFile) ? await Bun.file(tplFile).text() : FALLBACK_TEMPLATE;
  let text = fill(tpl, { title, id, date: vault.settings.engine.today, lang: lang ?? vault.defaultLang, type });
  const tags = str(args.flags, "tags");
  if (tags) text = setFrontmatter(text, { tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
  if (id !== basename(path, ".md").replace(/\.[a-z]{2}$/, "")) text = setFrontmatter(text, { id });
  await writeNew(join(vault.root, path), text);
  print(`${c.green("created")} ${path}`);
  if (args.flags.log) print(c.dim(await appendLog(vault.root, vault.settings.engine.today, "create", title)));
  return 0;
}

