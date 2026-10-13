/** Hash of everything that goes into clio.wasm, to tell whether the committed module is stale. */
import { Glob } from "bun";
import { createHash } from "node:crypto";

export async function engineSourceHash(root: string): Promise<string> {
  const files: string[] = ["Cargo.toml", "Cargo.lock", "rust-toolchain.toml"];
  for await (const f of new Glob("crates/**/*.{rs,toml}").scan({ cwd: root })) {
    if (!f.includes("/tests/")) files.push(f);
  }
  files.sort();
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f + "\0");
    h.update(await Bun.file(`${root}/${f}`).arrayBuffer().then((b) => new Uint8Array(b)));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

async function hashFiles(root: string, files: string[]): Promise<string> {
  files.sort();
  const h = createHash("sha256");
  for (const f of files) {
    h.update(f + "\0");
    h.update(await Bun.file(`${root}/${f}`).arrayBuffer().then((b) => new Uint8Array(b)));
    h.update("\0");
  }
  return h.digest("hex").slice(0, 16);
}

/** Hash of the web app sources, to tell whether packages/clio/web is stale. */
export async function webSourceHash(root: string): Promise<string> {
  const files = ["packages/web/package.json", "packages/web/vite.config.ts", "packages/web/tsconfig.json"];
  for await (const f of new Glob("packages/web/src/**/*").scan({ cwd: root, onlyFiles: true })) files.push(f);
  return hashFiles(root, files);
}
