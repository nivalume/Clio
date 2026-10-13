import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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
    const engine = await Engine.load();
    const wasmOut = commands.map((c) => JSON.stringify(engine.command(JSON.parse(c))));
    const proc = Bun.spawn([nativeBin], { stdin: "pipe", stdout: "pipe" });
    proc.stdin.write(commands.join("\n") + "\n");
    proc.stdin.end();
    const nativeOut = (await new Response(proc.stdout).text()).trim().split("\n");
    expect(nativeOut.length).toBe(wasmOut.length);
    for (let i = 0; i < wasmOut.length; i++) expect(nativeOut[i]).toBe(wasmOut[i]);
  });
});
