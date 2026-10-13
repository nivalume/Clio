import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pinHash } from "../src/commands/translate";
import { buildSite } from "../src/site/build";
import { parseChart, renderChart } from "../src/site/chart";
import { Vault } from "../src/vault";

const fixture = new URL("../../../crates/clio-core/tests/vault", import.meta.url).pathname;

describe("clio build", async () => {
  const out = mkdtempSync(join(tmpdir(), "clio-site-"));
  const vault = await Vault.open(fixture);
  const result = await buildSite(vault, { out, search: false, cache: false });
  const read = (p: string) => readFileSync(join(out, p), "utf8");
  const boot = (p: string) => JSON.parse(/<script type="application\/json" id="clio-boot">(.*?)<\/script>/s.exec(read(p))![1]);

  test("writes a page per note per language, plus Markdown mirrors", () => {
    expect(result.pages).toBe(result.notes * 2);
    for (const lang of ["zh", "en"]) {
      expect(existsSync(join(out, lang, "n/pratt-parser.html"))).toBe(true);
      expect(existsSync(join(out, lang, "n/pratt-parser.md"))).toBe(true);
    }
    expect(read("en/n/pratt-parser.md")).toContain("Pratt");
  });

  test("fills every placeholder", () => {
    for (const lang of ["zh", "en"]) {
      for (const id of ["pratt-parser", "index", "parsing", "tokenizer"]) {
        const html = read(`${lang}/n/${id}.html`);
        expect(html).not.toMatch(/[]/);
      }
    }
  });

  test("boot data describes the page", () => {
    const b = boot("en/n/pratt-parser.html");
    expect(b.route).toBe("note");
    expect(b.lang).toBe("en");
    expect(b.page.id).toBe("pratt-parser");
    expect(b.page.html).toBeUndefined();
    expect(b.data).toBe("/_clio/en/");
    expect(boot("zh/graph.html").route).toBe("graph");
  });

  test("writes the app data and the views", () => {
    for (const f of ["site", "manifest", "graph", "lint"]) expect(existsSync(join(out, `_clio/zh/${f}.json`))).toBe(true);
    const lint = JSON.parse(read("_clio/zh/lint.json"));
    expect(Array.isArray(lint.diags)).toBe(true);
    expect(Array.isArray(lint.wanted)).toBe(true);
    const site = JSON.parse(read("_clio/zh/site.json"));
    expect(site.index?.html).toContain("query-list");
    for (const f of ["index.html", "404.html", "llms.txt", ".nojekyll", "zh/index.html", "en/explore.html", "zh/tags.html", "zh/wanted.html", "_app/app.js", "_app/katex/katex.min.css"]) {
      expect(existsSync(join(out, f))).toBe(true);
    }
    expect(read("index.html")).toContain('localStorage.getItem("clio-lang")');
  });

  test("llms.txt lists notes with their Markdown URLs", () => {
    const llms = read("llms.txt");
    expect(llms).toStartWith("# ");
    expect(llms).toContain("/zh/n/pratt-parser.md");
  });

  test("refuses to build over the vault", async () => {
    await expect(buildSite(vault, { out: fixture, search: false })).rejects.toThrow("refusing");
  });

  afterAll(() => rmSync(out, { recursive: true, force: true }));
});

describe("charts", () => {
  test("YAML and CSV give the same spec", () => {
    const yaml = parseChart("type: bar\nx: [a, b]\nseries:\n  - name: s\n    data: [1, 2]\n");
    const csv = parseChart("x,s\na,1\nb,2\n");
    expect(csv.x).toEqual(yaml.x);
    expect(csv.series).toEqual(yaml.series);
  });

  test("renders bars from zero with a tooltip per mark and a data table", () => {
    const svg = renderChart("type: bar\ntitle: T\nx: [a, b, c]\nseries:\n  - name: one\n    data: [3, -1, 5]\n  - name: two\n    data: [1, 2, null]\n");
    expect(svg).toContain("<figcaption>T</figcaption>");
    expect((svg.match(/<path d=/g) ?? []).length).toBe(5);
    expect(svg).toContain("<title>one · b: -1</title>");
    expect(svg).toContain('class="chart-legend"');
    expect(svg).toContain("<table>");
  });

  test("bad input falls back to the source", () => {
    expect(renderChart("just words")).toContain('class="chart-source"');
  });
});

describe("translate-status --pin", () => {
  test("replaces or adds the hash in frontmatter", () => {
    expect(pinHash("---\ntitle: A\ntranslation-of-hash: \"old\"\n---\nbody\n", "abc")).toBe('---\ntitle: A\ntranslation-of-hash: "abc"\n---\nbody\n');
    expect(pinHash("---\ntitle: A\n---\nbody\n", "abc")).toBe('---\ntitle: A\ntranslation-of-hash: "abc"\n---\nbody\n');
    expect(pinHash("body\n", "abc")).toBe('---\ntranslation-of-hash: "abc"\n---\n\nbody\n');
  });
});
