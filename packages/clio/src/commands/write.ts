/** Commands that change the vault: `clio ingest`, `clio log`, `clio mv`. */
import { existsSync } from "node:fs";
import { copyFile, mkdir, rename } from "node:fs/promises";
import { basename, dirname, extname, join, posix, resolve } from "node:path";
import { str, type Args } from "../args";
import { appendLog, fill, folderFor, frontmatter, setFrontmatter, slugify, writeNew } from "../files";
import { c, fail, print } from "../ui";
import { sha256File, type Vault } from "../vault";
import { pinHash, type TranslationRow } from "./translate";

const SOURCE_TEMPLATE = `---
title: {{title}}
type: source
summary:
tags: []
status: draft
created: {{date}}
updated: {{date}}
---
# {{title}}

## Claims

`;

const EXT_BY_TYPE: Record<string, string> = {
  "text/html": ".html",
  "application/pdf": ".pdf",
  "text/markdown": ".md",
  "text/plain": ".txt",
  "application/json": ".json",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/svg+xml": ".svg",
};

export async function ingest(vault: Vault, args: Args): Promise<number> {
  const input = args.positionals[0];
  if (!input) fail('usage: clio ingest <file|url> [--title "Title"]');
  const date = vault.settings.engine.today;
  const isUrl = /^https?:\/\//i.test(input);
  let data: ArrayBuffer;
  let ext: string;
  let stem: string;
  if (isUrl) {
    const res = await fetch(input);
    if (!res.ok) fail(`download failed: ${res.status} ${res.statusText}`);
    data = await res.arrayBuffer();
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const urlPath = new URL(input).pathname;
    ext = extname(urlPath) || EXT_BY_TYPE[type] || ".html";
    stem = basename(urlPath, extname(urlPath)) || new URL(input).hostname;
  } else {
    const file = resolve(input);
    if (!existsSync(file)) fail(`no such file: ${input}`);
    data = await Bun.file(file).arrayBuffer();
    ext = extname(file);
    stem = basename(file, ext);
  }
  const title = str(args.flags, "title") ?? stem.replace(/[-_]+/g, " ");
  const id = str(args.flags, "id") ?? slugify(title);
  if (!id) fail("could not make an id from the title; pass --id");
  const taken = vault.resolve(id);
  if (taken && taken.id.toLowerCase() === id.toLowerCase()) fail(`id "${id}" is taken by ${taken.path}`);

  // raw/<id><ext>; never overwrite a different file.
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data);
  const sha = hasher.digest("hex");
  let rawPath = `raw/${id}${ext.toLowerCase()}`;
  for (let n = 2; existsSync(join(vault.root, rawPath)) && (await sha256File(join(vault.root, rawPath))) !== sha; n++) {
    rawPath = `raw/${id}-${n}${ext.toLowerCase()}`;
  }
  await mkdir(join(vault.root, "raw"), { recursive: true });
  if (!existsSync(join(vault.root, rawPath))) {
    if (isUrl) await Bun.write(join(vault.root, rawPath), data);
    else await copyFile(resolve(input), join(vault.root, rawPath));
  }
  print(`${rawPath}  sha256 ${sha.slice(0, 6)}…${sha.slice(-4)}`);

  const folder = folderFor(vault.root, vault.settings, "source");
  const notePath = `${folder}${id}.md`;
  if (existsSync(join(vault.root, notePath))) fail(`${notePath} already exists`);
  const tplFile = join(vault.root, "templates/source.md");
  const tpl = existsSync(tplFile) ? await Bun.file(tplFile).text() : SOURCE_TEMPLATE;
  let text = fill(tpl, { title, id, date, lang: vault.defaultLang, type: "source" });
  const meta: Record<string, string> = { type: "source", status: "draft", raw: rawPath, sha256: sha };
  if (isUrl) meta.url = input;
  text = setFrontmatter(text, meta);
  if (id !== basename(notePath, ".md")) text = setFrontmatter(text, { id });
  await writeNew(join(vault.root, notePath), text);
  print(`${c.green("created")} ${notePath} (draft)`);
  const entry = await appendLog(vault.root, date, "ingest", title, [`- raw: ${rawPath}`, `- created: ${notePath}`]);
  print(`log.md  ${entry}`);
  return 0;
}

export async function log(vault: Vault, args: Args): Promise<number> {
  const [op, ...rest] = args.positionals;
  const title = rest.join(" ").trim();
  if (!op || !title) fail('usage: clio log <op> "<title>"   (op: ingest, query, lint, edit, …)');
  const lines = str(args.flags, "message")?.split("\n").filter(Boolean) ?? [];
  print(`log.md  ${await appendLog(vault.root, vault.settings.engine.today, op, title, lines)}`);
  return 0;
}

/** Apply `fn` to the parts of a Markdown body outside fenced code blocks and inline code spans. */
function outsideCode(text: string, fn: (s: string) => string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of text.split(/(?<=\n)/)) {
    const m = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fence) {
      out.push(line);
      if (m && m[1][0] === fence[0] && m[1].length >= fence.length && line.trim() === m[1]) fence = null;
      continue;
    }
    if (m) {
      fence = m[1];
      out.push(line);
      continue;
    }
    out.push(line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 ? part : fn(part))).join(""));
  }
  return out.join("");
}

const key = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

export async function mv(vault: Vault, args: Args): Promise<number> {
  const [oldArg, newId] = args.positionals;
  if (!oldArg || !newId) fail("usage: clio mv <old-id> <new-id>");
  const found = vault.resolve(oldArg);
  if (!found) fail(`no note matches "${oldArg}"`);
  const oldId = found.id;
  const clash = vault.resolve(newId);
  if (clash && clash.id !== oldId) fail(`"${newId}" already points to ${clash.path}`);
  if (key(newId) === key(oldId)) fail("the new id is the same as the old one");

  const before = vault.engine.command<TranslationRow[]>({ cmd: "translations" });
  const row = before.find((r) => r.id === oldId);
  const variants = [row?.path ?? found.path, ...(row?.translations.map((t) => t.path).filter((p): p is string => !!p) ?? [])];
  const currentTranslations = new Set(before.flatMap((r) => r.translations.filter((t) => t.status === "current" && t.path).map((t) => t.path!)));

  // New paths: rename files named after the id; otherwise keep the file and change its `id:`.
  const moves = new Map<string, string>();
  for (const p of variants) {
    const dir = posix.dirname(p) === "." ? "" : `${posix.dirname(p)}/`;
    const m = /^(.*?)((?:\.[a-z]{2}(?:-[A-Za-z]+)?)?)\.md$/.exec(posix.basename(p))!;
    if (key(m[1]) === key(oldId)) moves.set(p, `${dir}${newId}${m[2]}.md`);
  }
  for (const [, to] of moves) if (existsSync(join(vault.root, to))) fail(`${to} already exists`);

  const isOld = (target: string) => {
    const t = target.trim().replace(/\.md$/i, "");
    const last = t.includes("/") ? t.slice(t.lastIndexOf("/") + 1) : t;
    return key(t) === key(oldId) || (t.includes("/") && key(last) === key(oldId) && variants.some((v) => v.replace(/\.md$/, "").endsWith(t)));
  };
  const swapTarget = (target: string) => {
    const t = target.trim();
    const ext = /\.md$/i.test(t) ? t.slice(-3) : "";
    const base = ext ? t.slice(0, -3) : t;
    return base.includes("/") ? `${base.slice(0, base.lastIndexOf("/") + 1)}${newId}${ext}` : `${newId}${ext}`;
  };

  let links = 0;
  const changedFiles: string[] = [];
  for (const file of vault.files) {
    const abs = join(vault.root, file);
    const text = await Bun.file(abs).text();
    const newPathOf = (p: string) => moves.get(p) ?? p;
    const selfNew = newPathOf(file);
    // Frontmatter: `id:` on the renamed note, and ids inside `rel:`.
    const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    let head = fmMatch ? fmMatch[0] : "";
    let body = fmMatch ? text.slice(head.length) : text;
    if (fmMatch) {
      let inRel = false;
      head = head
        .split("\n")
        .map((line) => {
          if (/^rel:\s*(\{.*)?$/.test(line)) inRel = true;
          else if (/^\S/.test(line)) inRel = false;
          if (variants.includes(file) && /^id:\s*/.test(line) && key(String(frontmatter(text).id ?? "")) === key(oldId)) {
            links++;
            return `id: ${newId}`;
          }
          if (!inRel && !/^rel:/.test(line)) return line;
          return line.replace(/(\[\[)?([^\s,[\]{}:"']+)(\]\])?/g, (m0, open: string | undefined, id: string, close: string | undefined, offset: number, whole: string) => {
            const prev = whole[offset - 1];
            if (offset === 0 || !(prev === " " || prev === "[" || prev === "," || prev === "{" || prev === "-" || prev === '"' || prev === "'")) return m0;
            if (whole[offset + m0.length] === ":" || key(id) !== key(oldId)) return m0;
            links++;
            return `${open ?? ""}${newId}${close ?? ""}`;
          });
        })
        .join("\n");
    }
    body = outsideCode(body, (s) =>
      s
        .replace(/(!?\[\[)([^\]\n]*?)(\]\])/g, (m0, open: string, inner: string, close: string) => {
          const relMatch = /^([\w-]+::)?(.*)$/.exec(inner)!;
          const rel = relMatch[1] ?? "";
          const rest = relMatch[2];
          const cut = rest.search(/[#^|]/);
          const target = cut >= 0 ? rest.slice(0, cut) : rest;
          if (!target.trim() || !isOld(target)) return m0;
          links++;
          return `${open}${rel}${swapTarget(target)}${cut >= 0 ? rest.slice(cut) : ""}${close}`;
        })
        .replace(/\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g, (m0, href: string, anchor: string | undefined) => {
          if (/^[a-z]+:/i.test(href)) return m0;
          const resolved = posix.normalize(posix.join(posix.dirname(file), decodeURI(href)));
          const to = moves.get(resolved);
          if (!to) return m0;
          links++;
          let relPath = posix.relative(posix.dirname(selfNew), to);
          if (!relPath.startsWith(".")) relPath = `./${relPath}`.replace(/^\.\/(?=[^.])/, "");
          return `](${encodeURI(relPath)}${anchor ?? ""})`;
        }),
    );
    const next = head + body;
    if (next !== text) {
      await Bun.write(abs, next);
      changedFiles.push(file);
    }
  }
  for (const [from, to] of moves) {
    await mkdir(dirname(join(vault.root, to)), { recursive: true });
    await rename(join(vault.root, from), join(vault.root, to));
    print(`renamed ${from} → ${to}`);
  }
  await vault.sync();
  // Translations that were current stay current: only links changed.
  const after = vault.engine.command<TranslationRow[]>({ cmd: "translations" });
  for (const r of after) {
    for (const t of r.translations) {
      if (t.status !== "stale" || !t.path) continue;
      const wasPath = [...moves.entries()].find(([, to]) => to === t.path)?.[0] ?? t.path;
      if (!currentTranslations.has(wasPath)) continue;
      const abs = join(vault.root, t.path);
      await Bun.write(abs, pinHash(await Bun.file(abs).text(), r.hash));
    }
  }
  print(`rewrote ${links} links in ${changedFiles.length} files`);
  return 0;
}

