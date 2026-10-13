/**
 * P0 docs build: render docs/*.md through the WebAssembly engine into
 * docs/.clio/site, then index it with Pagefind. Replaced by `clio build` later.
 */
import { mkdir, readdir, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import * as pagefind from "pagefind";
import { Wasm } from "../packages/clio/src/wasm";

const root = new URL("..", import.meta.url).pathname;
const docs = join(root, "docs");
const out = join(docs, ".clio/site");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "n"), { recursive: true });

const engine = await Wasm.load();
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const page = (title: string, body: string) =>
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Clio</title></head><body><main data-pagefind-body>${body}</main></body></html>`;

const files = (await readdir(docs)).filter((f) => f.endsWith(".md"));
for (const f of files) {
  const id = basename(f, ".md");
  const html = engine.call("clio_render", await Bun.file(join(docs, f)).text())
    .replace(/<a href="([^"]+)" data-wikilink="true">/g, (_m, t) => `<a href="/n/${t}">`);
  await Bun.write(id === "index" ? join(out, "index.html") : join(out, "n", `${id}.html`), page(id, html));
}
const { index } = await pagefind.createIndex({});
await index!.addDirectory({ path: out });
await index!.writeFiles({ outputPath: join(out, "pagefind") });
await pagefind.close();
console.log(`built ${files.length} pages into ${out}`);
