/**
 * Check the engine's PageRank and Louvain against graphology on a synthetic
 * vault with planted communities.
 */
import { describe, expect, test } from "bun:test";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import pagerank from "graphology-metrics/centrality/pagerank";
import modularity from "graphology-metrics/graph/modularity";
import { generate } from "../../../bench/gen";
import { Engine } from "../src/engine";

async function engineFor(count: number) {
  const engine = await Engine.load();
  engine.command({ cmd: "config", config: { locales: ["zh"], today: "2026-10-13" } });
  for (const n of generate({ count, seed: 11 })) engine.upsert(n.path, n.text);
  engine.command({ cmd: "build" });
  return engine;
}

type G = { nodes: { id: string; rank: number; cluster: number; wanted?: boolean }[]; edges: [number, number, number][] };

describe("graph algorithms", async () => {
  const engine = await engineFor(600);
  const g = engine.command<G>({ cmd: "graph" });
  const real = g.nodes.filter((n) => !n.wanted);
  const directed = new Graph({ type: "directed", multi: false });
  real.forEach((n) => directed.addNode(n.id));
  for (const [s, t] of g.edges) {
    if (t >= real.length || s === t) continue;
    directed.mergeEdge(real[s].id, real[t].id);
  }

  test("PageRank matches graphology", () => {
    const theirs = pagerank(directed, { alpha: 0.85, maxIterations: 200, tolerance: 1e-12, getEdgeWeight: null });
    let maxDiff = 0;
    for (const n of real) maxDiff = Math.max(maxDiff, Math.abs(n.rank - theirs[n.id]));
    expect(maxDiff).toBeLessThan(2e-4);
  });

  test("Louvain finds communities about as good as graphology's", () => {
    const undirected = new Graph({ type: "undirected", multi: false });
    real.forEach((n) => undirected.addNode(n.id));
    directed.forEachEdge((_e, _a, s, t) => {
      undirected.mergeEdge(s, t);
    });
    const ours: Record<string, number> = Object.fromEntries(real.map((n) => [n.id, n.cluster]));
    const qOurs = modularity(undirected, { getNodeCommunity: (n: string) => ours[n] });
    const qTheirs = louvain.detailed(undirected, { rng: () => 0.5 }).modularity;
    expect(qOurs).toBeGreaterThan(0.3);
    expect(qOurs).toBeGreaterThan(qTheirs * 0.9);
  });

  test("results are deterministic", async () => {
    const again = (await engineFor(600)).command<G>({ cmd: "graph" });
    expect(JSON.stringify(again)).toBe(JSON.stringify(g));
  });
});
