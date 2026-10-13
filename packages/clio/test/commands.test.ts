import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src/cli";
import { buildSite } from "../src/site/build";
import { Vault } from "../src/vault";

process.env.CLIO_TODAY = "2026-10-13";
const tmp = mkdtempSync(join(tmpdir(), "clio-cmd-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/** Run the CLI with stdout captured. */
async function run(...argv: string[]): Promise<{ code: number; out: string }> {
  const write = process.stdout.write.bind(process.stdout);
  let out = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    out += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;
  try {
    return { code: await main(argv), out };
  } finally {
    process.stdout.write = write;
  }
}

async function errorsOf(dir: string): Promise<number> {
  const vault = await Vault.open(dir);
  return vault.build().errors;
}

describe("clio new site", () => {
  for (const starter of ["llm-wiki", "docs", "blank"]) {
    for (const locales of ["zh,en", "en"]) {
      test(`${starter} (${locales}) checks and builds`, async () => {
        const dir = join(tmp, `${starter}-${locales.replace(",", "-")}`);
        const r = await run("new", "site", dir, "--starter", starter, "--locales", locales, "--title", "T: test");
        expect(r.code).toBe(0);
        for (const f of ["clio.toml", "AGENTS.md", "CLAUDE.md", "package.json", "vercel.json", ".gitignore", ".github/workflows/pages.yml", "skills/clio/SKILL.md", ".claude/skills/clio/SKILL.md", ".agents/skills/clio/SKILL.md"]) {
          expect(existsSync(join(dir, f))).toBe(true);
        }
        expect(await errorsOf(dir)).toBe(0);
        const vault = await Vault.open(dir);
        const res = await buildSite(vault, { out: join(dir, ".clio/site"), search: false, cache: false });
        expect(res.pages).toBeGreaterThan(0);
        // Shipped translations are pinned.
        const rows = vault.engine.command<{ translations: { status: string }[] }[]>({ cmd: "translations" });
        expect(rows.flatMap((x) => x.translations).filter((x) => x.status === "stale" || x.status === "unpinned")).toEqual([]);
      });
    }
  }

  test("refuses a non-empty directory", async () => {
    const dir = join(tmp, "llm-wiki-en");
    const proc = Bun.spawnSync(["bun", join(import.meta.dir, "../bin/clio.ts"), "new", "site", dir]);
    expect(proc.exitCode).toBe(1);
  });
});

describe("vault commands", () => {
  const dir = join(tmp, "work");

  test("ingest, new, log", async () => {
    await run("new", "site", dir, "--locales", "zh");
    const src = join(tmp, "paper.txt");
    writeFileSync(src, "Some source text.\n");
    expect((await run("ingest", src, "--title", "A Paper", "--dir", dir)).code).toBe(0);
    const note = readFileSync(join(dir, "notes/sources/a-paper.md"), "utf8");
    expect(note).toContain("raw: raw/a-paper.txt");
    expect(note).toMatch(/sha256: [0-9a-f]{64}/);
    expect(note).toContain("status: draft");
    expect((await run("new", "concept", "Binding power", "--tags", "parsing", "--dir", dir)).code).toBe(0);
    expect(readFileSync(join(dir, "notes/concepts/binding-power.md"), "utf8")).toContain("tags: [parsing]");
    await run("log", "query", "What is binding power?", "--dir", dir);
    const log = readFileSync(join(dir, "log.md"), "utf8");
    expect(log).toContain("## [2026-10-13] ingest | A Paper");
    expect(log).toContain("## [2026-10-13] query | What is binding power?");
    expect(await errorsOf(dir)).toBe(0);
  });

  test("raw-modified is an error", async () => {
    writeFileSync(join(dir, "raw/a-paper.txt"), "Changed.\n");
    const vault = await Vault.open(dir);
    expect(vault.lint().some((d) => d.code === "raw-modified" && d.path === "notes/sources/a-paper.md")).toBe(true);
    writeFileSync(join(dir, "raw/a-paper.txt"), "Some source text.\n");
    await vault.sync();
    expect(vault.lint().some((d) => d.code === "raw-modified")).toBe(false);
  });

  test("mv renames the file and rewrites links outside code", async () => {
    writeFileSync(join(dir, "notes/concepts/user.md"), "---\nrel:\n  depends-on: [binding-power]\n---\n# User\n\nSee [[binding-power|bp]] and ![[binding-power#Intro]].\n\n`[[binding-power]]` stays.\n\n```\n[[binding-power]]\n```\n");
    const r = await run("mv", "binding-power", "binding-strength", "--dir", dir);
    expect(r.code).toBe(0);
    expect(existsSync(join(dir, "notes/concepts/binding-strength.md"))).toBe(true);
    expect(existsSync(join(dir, "notes/concepts/binding-power.md"))).toBe(false);
    const user = readFileSync(join(dir, "notes/concepts/user.md"), "utf8");
    expect(user).toContain("depends-on: [binding-strength]");
    expect(user).toContain("[[binding-strength|bp]]");
    expect(user).toContain("![[binding-strength#Intro]]");
    expect(user).toContain("`[[binding-power]]` stays");
    expect(user).toContain("```\n[[binding-power]]\n```");
  });

  test("init --adopt maps known folders", async () => {
    const obs = join(tmp, "obsidian");
    for (const [p, t] of [["Papers/a.md", "# A\n"], ["People/Ada.md", "# Ada\n"], ["Misc/x.md", "# X\n"]]) {
      const f = join(obs, p);
      await Bun.write(f, t);
    }
    expect((await run("init", "--adopt", "--dir", obs, "--locales", "en")).code).toBe(0);
    const toml = readFileSync(join(obs, "clio.toml"), "utf8");
    expect(toml).toContain('"Papers/" = "source"');
    expect(toml).toContain('"People/" = "entity"');
    expect(toml).toContain('# "Misc/" = "note"');
    expect(existsSync(join(obs, "skills/clio/SKILL.md"))).toBe(true);
  });
});
