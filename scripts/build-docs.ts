/**
 * P0 docs build: render docs/*.md through the WebAssembly engine into
 * docs/.clio/site, then index it with Pagefind. Replaced by `clio build` later.
 */
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import * as pagefind from "pagefind";
import { Engine } from "../packages/clio/src/engine";

const root = new URL("..", import.meta.url).pathname;
const docs = join(root, "docs");
const out = join(docs, ".clio/site");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "n"), { recursive: true });

const engine = await Engine.load();
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const page = (title: string, body: string) =>
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Clio</title></head><body><main data-pagefind-body>${body}</main></body></html>`;

const files = (await readdir(docs)).filter((f) => f.endsWith(".md"));
for (const f of files) {
  const id = basename(f, ".md");
  type Parsed = { html: string; links: { target: string; label: string | null }[]; plugins: { fallback: string }[] };
  const note = engine.command<Parsed>({ cmd: "parse", path: f, text: await Bun.file(join(docs, f)).text() });
  // Interim marker filling until the vault phase lands.
  const html = note.html.replace(/\uE000([A-Za-z])(\d+)\uE001/g, (_m, k: string, n: string) => {
    const i = Number(n);
    if (k === "L") return `<a href="/n/${encodeURIComponent(note.links[i]?.target ?? "")}">`;
    if (k === "t") return escape(note.links[i]?.target ?? "");
    if (k === "B") return note.plugins[i]?.fallback ?? "";
    return "";
  });
  await Bun.write(id === "index" ? join(out, "index.html") : join(out, "n", `${id}.html`), page(id, html));
}
const { index } = await pagefind.createIndex({});
await index!.addDirectory({ path: out });
await index!.writeFiles({ outputPath: join(out, "pagefind") });
await pagefind.close();
console.log(`built ${files.length} pages into ${out}`);
