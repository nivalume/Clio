/**
 * Build benchmark on a synthetic vault.
 *
 *   bun bench/run.ts [count=20000] [--dir DIR]
 *
 * Measures: the engine alone (parse, vault phase, cold layout) in this
 * process; then `clio build` cold (no caches), warm (caches, nothing
 * changed) and after adding one note, each in a fresh process. Reports how
 * far the layout moved after the added note. Prints JSON.
 */
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Vault } from "../packages/clio/src/vault";

const count = Number(process.argv[2] ?? 20000);
const dirFlag = process.argv.indexOf("--dir");
const dir = dirFlag > 0 ? process.argv[dirFlag + 1] : join(process.env.TMPDIR ?? "/tmp", `clio-bench-${count}`);
const root = new URL("..", import.meta.url).pathname;
const cli = join(root, "packages/clio/bin/clio.ts");

if (!existsSync(join(dir, "clio.toml"))) {
  await rm(dir, { recursive: true, force: true });
  const proc = Bun.spawnSync(["bun", join(root, "bench/gen.ts"), String(count), dir], { stdout: "ignore", stderr: "inherit" });
  if (proc.exitCode !== 0) process.exit(1);
}

const ms = (t: number) => Math.round(performance.now() - t);
const t0 = performance.now();
const vault = await Vault.open(dir);
const parse = ms(t0);
const t1 = performance.now();
const summary = vault.build();
const phase = ms(t1);
const t2 = performance.now();
vault.engine.command({ cmd: "layout" });
const layout = ms(t2);

const cacheDirs = [join(dir, "node_modules/.cache/clio"), join(dir, ".clio")];
const build = () => {
  const t = performance.now();
  const p = Bun.spawnSync(["bun", cli, "build", "--dir", dir, "--json"], { stdout: "pipe", stderr: "inherit", env: { ...process.env, NO_COLOR: "1" } });
  if (p.exitCode !== 0) throw new Error("build failed");
  const out = new TextDecoder().decode(p.stdout);
  const json = JSON.parse(out.slice(out.indexOf("{")));
  return { ms: ms(t), pages: json.pages as number };
};
const layoutFile = existsSync(join(dir, "node_modules")) ? join(dir, "node_modules/.cache/clio/layout.json") : join(dir, ".clio/cache/layout.json");
const readLayout = async () => (await Bun.file(layoutFile).json()) as { keys: string[]; x: number[]; y: number[] };

for (const d of cacheDirs) await rm(d, { recursive: true, force: true });
const cold = build();
const warm = build();
const before = await readLayout();

// Add one note linked to three existing ones.
const ids = before.keys.slice(0, 3);
await Bun.write(join(dir, "notes/bench-added.md"), `---\ntitle: Added note\n---\n# Added note\n\nLinks to ${ids.map((k) => `[[${k}]]`).join(", ")}.\n`);
const added = build();
const after = await readLayout();
await rm(join(dir, "notes/bench-added.md"));

const pos = new Map(after.keys.map((k, i) => [k, [after.x[i], after.y[i]] as const]));
let extent = 0;
for (let i = 0; i < before.x.length; i++) extent = Math.max(extent, Math.hypot(before.x[i], before.y[i]));
let moved = 0;
let far = 0;
for (let i = 0; i < before.keys.length; i++) {
  const p = pos.get(before.keys[i]);
  if (!p) continue;
  const d = Math.hypot(p[0] - before.x[i], p[1] - before.y[i]);
  moved += d;
  if (d > extent * 0.02) far++;
}

const result = {
  notes: summary.notes,
  edges: summary.edges,
  wanted: summary.wanted,
  engine: { parse_ms: parse, vault_ms: phase, layout_cold_ms: layout, total_ms: parse + phase + layout },
  build: { cold_ms: cold.ms, warm_ms: warm.ms, after_adding_one_ms: added.ms, pages: cold.pages },
  layout_stability: { mean_move_of_extent: +(moved / before.keys.length / extent).toFixed(4), nodes_moved_over_2pct: far },
  bun: Bun.version,
  date: new Date().toISOString().slice(0, 10),
};
console.log(JSON.stringify(result, null, 2));
