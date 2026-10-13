import { useEffect, useMemo, useRef } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { shapePath } from "../lib/shapes";
import { typeStyle } from "../lib/styles";
import type { PageData } from "../lib/types";
import { navigate } from "../lib/router";

interface N extends SimulationNodeDatum {
  i: number;
  id: string;
  title: string;
  type: string;
  url: string;
  center: boolean;
  wanted: boolean;
}

/** The note and its direct neighbours; a fan laid out with d3-force (≤ ~150 nodes). */
export function LocalGraph({ page, height = 280 }: { page: PageData; height?: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { nodes, links } = useMemo(() => {
    const nodes: N[] = page.local.nodes.slice(0, 150).map((n, i) => ({
      i,
      id: n.id,
      title: n.title,
      type: n.wanted ? "wanted" : n.type,
      url: n.url,
      center: n.id === page.id,
      wanted: Boolean(n.wanted),
    }));
    const ok = new Set(nodes.map((n) => n.i));
    const links = page.local.edges.filter(([s, t]) => ok.has(s) && ok.has(t)).map(([s, t, kind]) => ({ source: s, target: t, kind }));
    return { nodes, links };
  }, [page]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 320;
    const h = height;
    const sim = forceSimulation(nodes)
      .force("link", forceLink(links).id((d) => (d as N).i).distance(70).strength(0.6))
      .force("charge", forceManyBody().strength(-220))
      .force("collide", forceCollide(22))
      .force("x", forceX(w / 2).strength(0.07))
      .force("y", forceY(h / 2).strength(0.1))
      .stop();
    const center = nodes.find((n) => n.center);
    if (center) {
      center.fx = w / 2;
      center.fy = h / 2;
    }
    for (let i = 0; i < 260; i++) sim.tick();
    // Fit into the box.
    const xs = nodes.map((n) => n.x ?? 0);
    const ys = nodes.map((n) => n.y ?? 0);
    const pad = 34;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad + 12;
    svg.setAttribute("viewBox", `${minX} ${minY} ${Math.max(maxX - minX, 1)} ${Math.max(maxY - minY, 1)}`);
    const g = svg.querySelector("g.lg-root")!;
    g.innerHTML = "";
    const ns = "http://www.w3.org/2000/svg";
    for (const l of links) {
      const s = l.source as unknown as N;
      const t = l.target as unknown as N;
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(s.x));
      line.setAttribute("y1", String(s.y));
      line.setAttribute("x2", String(t.x));
      line.setAttribute("y2", String(t.y));
      line.setAttribute("class", `g-edge${l.kind === "link" || l.kind === "embed" ? "" : " g-edge--typed"}`);
      g.append(line);
    }
    const many = nodes.length > 12;
    for (const n of nodes) {
      const st = typeStyle(n.type);
      const a = document.createElementNS(ns, "a");
      a.setAttribute("href", n.url);
      a.setAttribute("class", `g-node${n.center ? " g-node--center" : ""}${n.wanted ? " g-node--wanted" : ""}`);
      a.setAttribute("transform", `translate(${n.x},${n.y})`);
      const r = n.center ? 13 : 8;
      const path = document.createElementNS(ns, "path");
      path.setAttribute("d", shapePath(st.shape, r));
      path.setAttribute("class", "shape");
      path.setAttribute("style", `fill:${n.wanted ? "var(--card)" : st.color}`);
      a.append(path);
      if (!many || n.center || n.type === "topic" || n.type === "guide") {
        const text = document.createElementNS(ns, "text");
        text.setAttribute("y", String(r + 4));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "hanging");
        text.textContent = n.title.length > 14 ? `${n.title.slice(0, 13)}…` : n.title;
        a.append(text);
      }
      const title = document.createElementNS(ns, "title");
      title.textContent = n.title;
      a.append(title);
      a.addEventListener("click", (e) => {
        e.preventDefault();
        navigate(n.url);
      });
      g.append(a);
    }
    return () => {
      sim.stop();
    };
  }, [nodes, links, height]);

  return (
    <div className="local-graph" style={{ height }}>
      <svg ref={svgRef} role="img" aria-label={`${page.title}: ${nodes.length - 1} neighbours`}>
        <g className="lg-root" />
      </svg>
    </div>
  );
}
