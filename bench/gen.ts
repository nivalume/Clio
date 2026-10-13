/**
 * Synthetic vault generator for benchmarks and graph tests.
 *
 *   bun bench/gen.ts <count> <out-dir> [--seed N]
 *
 * Notes fall into planted communities (one hub topic each). Each note links
 * mostly inside its community, with a power-law number of links and a bias
 * towards popular notes, some typed relations, about 1% links to notes that
 * do not exist, and mixed Chinese/English text.
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

export class Rng {
  constructor(private s: bigint) {}
  next(): number {
    this.s = (this.s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z ^= z >> 31n;
    return Number(z >> 11n) / 2 ** 53;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  pick<T>(xs: T[]): T {
    return xs[this.int(xs.length)];
  }
}

const ZH = "知识 图谱 链接 笔记 概念 实体 来源 问题 结构 模型 数据 关系 推理 检索 上下文 记忆 索引 版本 证据 结论 方法 系统 引擎 渲染 解析 布局 聚类 社区 节点 边 权重 排序 搜索 翻译 维护".split(" ");
const EN = "graph link note concept entity source question structure model data relation inference retrieval context memory index version evidence claim method system engine render parse layout cluster community node edge weight rank search translate maintain".split(" ");

export interface GenOptions {
  count: number;
  seed?: number;
}

export interface GenNote {
  path: string;
  text: string;
}

export function generate({ count, seed = 7 }: GenOptions): GenNote[] {
  const rng = new Rng(BigInt(seed));
  const k = Math.max(4, Math.round(count / 200));
  const community = Array.from({ length: count }, (_, i) => (i < k ? i : rng.int(k)));
  const members: number[][] = Array.from({ length: k }, () => []);
  community.forEach((c, i) => members[c].push(i));
  const typeOf = (i: number) => {
    if (i < k) return "topic";
    const r = rng.next();
    return r < 0.6 ? "concept" : r < 0.8 ? "entity" : r < 0.95 ? "source" : "question";
  };
  const types = Array.from({ length: count }, (_, i) => typeOf(i));
  // Popularity: a note's chance to be linked falls off like 1/(position in community + 1).
  const pickIn = (c: number) => {
    const m = members[c];
    const u = rng.next();
    const idx = Math.min(m.length - 1, Math.floor(Math.exp(u * Math.log(m.length + 1)) - 1));
    return m[idx];
  };
  const words = (n: number) => {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(rng.next() < 0.5 ? rng.pick(ZH) : rng.pick(EN));
    return out.join(rng.next() < 0.5 ? "" : " ");
  };
  const notes: GenNote[] = [];
  for (let i = 0; i < count; i++) {
    const c = community[i];
    const id = `n${i}`;
    const type = types[i];
    const linkCount = Math.min(40, Math.floor(1 / (rng.next() * 0.95 + 0.05)) + 1);
    const links: string[] = [];
    for (let j = 0; j < linkCount; j++) {
      const r = rng.next();
      if (r < 0.01) links.push(`[[missing-${rng.int(count)}]]`);
      else {
        const target = r < 0.86 ? pickIn(c) : pickIn(rng.int(k));
        if (target === i) continue;
        const rel = rng.next() < 0.15 ? `${rng.pick(["depends-on", "supports", "see-also", "extends"])}::` : "";
        links.push(`[[${rel}n${target}]]`);
      }
    }
    const paras: string[] = [];
    const nPara = 2 + rng.int(5);
    for (let p = 0; p < nPara; p++) {
      const chunk = links.slice((p * links.length) / nPara, ((p + 1) * links.length) / nPara);
      paras.push(`${words(20 + rng.int(60))} ${chunk.join(" ")}`);
    }
    const fm = [
      "---",
      `title: ${type === "topic" ? `主题 ${c}` : `${rng.pick(ZH)}${rng.pick(EN)} ${i}`}`,
      `type: ${type}`,
      `tags: [c${c}${rng.next() < 0.3 ? `, ${rng.pick(EN)}` : ""}]`,
      i >= k ? `rel:\n  part-of: n${c}` : "",
      `updated: 2026-${String(1 + rng.int(12)).padStart(2, "0")}-${String(1 + rng.int(28)).padStart(2, "0")}`,
      "---",
    ].filter(Boolean);
    const folder = { topic: "topics", concept: "concepts", entity: "entities", source: "sources", question: "questions" }[type];
    notes.push({ path: `notes/${folder}/${id}.md`, text: `${fm.join("\n")}\n# ${id}\n\n${paras.join("\n\n")}\n\n## 小结\n\n${words(15)}\n` });
  }
  notes.push({ path: "index.md", text: "---\ntitle: 首页\n---\n# 首页\n\n```clio-query\ntype = topic SORT title\n```\n" });
  return notes;
}

if (import.meta.main) {
  const [countArg, outArg] = process.argv.slice(2);
  const seedIdx = process.argv.indexOf("--seed");
  const seed = seedIdx > 0 ? Number(process.argv[seedIdx + 1]) : 7;
  if (!countArg || !outArg) {
    console.error("usage: bun bench/gen.ts <count> <out-dir> [--seed N]");
    process.exit(2);
  }
  const notes = generate({ count: Number(countArg), seed });
  await rm(outArg, { recursive: true, force: true });
  await mkdir(outArg, { recursive: true });
  await Bun.write(join(outArg, "clio.toml"), `title = "Synthetic ${countArg}"\nlocales = ["zh"]\n`);
  for (const n of notes) await Bun.write(join(outArg, n.path), n.text);
  console.log(`wrote ${notes.length} notes to ${outArg}`);
}
