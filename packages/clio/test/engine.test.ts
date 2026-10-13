import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "../../../bench/gen";
import { Engine } from "../src/engine";

const root = join(import.meta.dir, "../../..");
const syntaxDir = join(root, "crates/clio-core/tests/syntax");
const nativeBin = join(root, "target/release/clio-native");

function inputs() {
  return readdirSync(syntaxDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({ path: `notes/concepts/${f}`, text: readFileSync(join(syntaxDir, f), "utf8") }));
}

describe("engine", () => {
  test("loads and answers", async () => {
    const engine = await Engine.load();
    expect(engine.command<{ version: string }>({ cmd: "version" }).version).toMatch(/^\d+\.\d+\.\d+/);
    expect(() => engine.command({ cmd: "nope" })).toThrow(/unknown command/);
  });

  test("upsert skips unchanged text", async () => {
    const engine = await Engine.load();
    engine.upsert("a.md", "# A\n");
    engine.upsert("a.md", "# A\n");
    expect(engine.command<{ notes: number }>({ cmd: "count" }).notes).toBe(1);
  });

  test("native and WebAssembly builds give identical output", async () => {
    if (!existsSync(nativeBin)) {
      console.warn("skipped: build target/release/clio-native first (cargo build --release -p clio-native)");
      return;
    }
    const commands = inputs().map((i) => JSON.stringify({ cmd: "parse", path: i.path, text: i.text }));
    // The whole-vault phase too: the fixture vault, then every read command.
    const vaultDir = join(root, "crates/clio-core/tests/vault");
    commands.push(JSON.stringify({ cmd: "config", config: { locales: ["zh", "en"], today: "2026-10-13" } }));
    for (const f of [...new Bun.Glob("**/*.md").scanSync({ cwd: vaultDir })].sort()) {
      commands.push(JSON.stringify({ cmd: "upsert", path: f, text: readFileSync(join(vaultDir, f), "utf8") }));
    }
    commands.push(JSON.stringify({ cmd: "build" }), JSON.stringify({ cmd: "lint" }), JSON.stringify({ cmd: "graph" }));
    commands.push(JSON.stringify({ cmd: "site", lang: "en" }), JSON.stringify({ cmd: "manifest" }), JSON.stringify({ cmd: "search", q: "解析 token" }));
    for (const id of ["index", "pratt-parser", "recursive-descent", "tokenizer", "parsing"]) {
      for (const lang of ["zh", "en"]) commands.push(JSON.stringify({ cmd: "page", id, lang }));
      commands.push(JSON.stringify({ cmd: "context", id, hops: 2 }));
    }
    // Layout: cold, the graph carrying positions, then a warm start.
    commands.push(JSON.stringify({ cmd: "layout" }), JSON.stringify({ cmd: "graph" }));
    commands.push(JSON.stringify({ cmd: "layout", previous: { keys: ["pratt-parser", "tokenizer"], x: [10.5, -3], y: [2, 7.25] } }));
    // A larger synthetic vault exercises Barnes–Hut deeply.
    commands.push(JSON.stringify({ cmd: "config", config: { locales: ["zh"], today: "2026-10-13" } }));
    for (const n of generate({ count: 1500, seed: 3 })) commands.push(JSON.stringify({ cmd: "upsert", path: n.path, text: n.text }));
    commands.push(JSON.stringify({ cmd: "build" }), JSON.stringify({ cmd: "layout" }));
    const engine = await Engine.load();
    const wasmOut = commands.map((c) => engine.commandRaw(c));
    const proc = Bun.spawn([nativeBin], { stdin: "pipe", stdout: "pipe" });
    proc.stdin.write(commands.join("\n") + "\n");
    proc.stdin.end();
    const nativeOut = (await new Response(proc.stdout).text()).trim().split("\n");
    expect(nativeOut.length).toBe(wasmOut.length);
    for (let i = 0; i < wasmOut.length; i++) expect(nativeOut[i]).toBe(wasmOut[i]);
  });
});
