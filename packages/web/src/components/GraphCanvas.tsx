import { useEffect, useMemo, useRef, useState } from "react";
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { drawShape } from "../lib/shapes";
import { typeStyle } from "../lib/styles";
import type { GraphData } from "../lib/types";

export interface Layout {
  x: Float64Array;
  y: Float64Array;
  r: Float64Array;
  /** Neighbour lists over visible edges (both directions). */
  adj: number[][];
}

interface SimNode extends SimulationNodeDatum {
  i: number;
  cluster: number;
}

/** Node radius from PageRank, relative to the uniform rank 1/n. */
function radius(rank: number, n: number, wanted: boolean): number {
  if (wanted) return 3.5;
  const rel = rank * Math.max(n, 1);
  return Math.max(3.5, Math.min(16, 3.5 + Math.sqrt(rel) * 2.6));
}

/**
 * Positions from the build (`x`/`y` on nodes) when present, else a force
 * layout computed once, synchronously, so the picture does not wobble.
 * Clusters are pulled towards their own anchor on a circle so they read as groups.
 */
export function computeLayout(g: GraphData): Layout {
  const n = g.nodes.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const r = new Float64Array(n);
  const real = g.nodes.filter((d) => !d.wanted).length;
  g.nodes.forEach((d, i) => (r[i] = radius(d.rank, real, Boolean(d.wanted))));
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const [s, t] of g.edges) {
    if (s >= n || t >= n || s === t) continue;
    adj[s].push(t);
    adj[t].push(s);
  }
  if (g.nodes.length && g.nodes.every((d) => typeof d.x === "number" && typeof d.y === "number")) {
    // Positions from the build have their own scale. Small graphs: bring the median distance to the
    // nearest node to ~48 units so labels fit; large ones: the mean edge length to ~40 units.
    let scale = 1;
    if (n <= 3000) {
      const nn: number[] = [];
      for (let i = 0; i < n; i++) {
        let best = Infinity;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          const d = Math.hypot(g.nodes[i].x! - g.nodes[j].x!, g.nodes[i].y! - g.nodes[j].y!);
          if (d < best) best = d;
        }
        if (Number.isFinite(best) && best > 0) nn.push(best);
      }
      nn.sort((a, b) => a - b);
      if (nn.length) scale = 48 / nn[Math.floor(nn.length / 2)];
    } else {
      let sum = 0;
      let count = 0;
      const step = Math.max(1, Math.floor(g.edges.length / 20000));
      for (let e = 0; e < g.edges.length; e += step) {
        const [s, t] = g.edges[e];
        if (s >= n || t >= n || s === t) continue;
        sum += Math.hypot(g.nodes[s].x! - g.nodes[t].x!, g.nodes[s].y! - g.nodes[t].y!);
        count++;
      }
      if (count && sum > 0) scale = 40 / (sum / count);
    }
    g.nodes.forEach((d, i) => {
      x[i] = d.x! * scale;
      y[i] = d.y! * scale;
    });
    return { x, y, r, adj };
  }
  const clusterCount = Math.max(1, ...g.nodes.map((d) => d.cluster + 1));
  const ring = Math.sqrt(n) * 30;
  const anchor = (c: number) => {
    if (c < 0 || clusterCount <= 1) return [0, 0];
    const a = (c / clusterCount) * Math.PI * 2;
    return [Math.cos(a) * ring, Math.sin(a) * ring];
  };
  const nodes: SimNode[] = g.nodes.map((d, i) => ({ i, cluster: d.cluster }));
  // Wanted nodes join the cluster of whoever links to them first.
  for (const [s, t] of g.edges) if (nodes[t] && nodes[t].cluster < 0 && nodes[s]) nodes[t].cluster = nodes[s].cluster;
  const links = g.edges.filter(([s, t]) => s < n && t < n && s !== t).map(([s, t]) => ({ source: s, target: t }));
  // Small graphs get more room so labels fit between nodes.
  const room = n < 300 ? 1.8 : n < 2000 ? 1.25 : 1;
  const sim = forceSimulation(nodes)
    .force("link", forceLink(links).id((d) => (d as SimNode).i).distance(42 * room).strength(0.3))
    .force("charge", forceManyBody().strength(-90 * room * room).distanceMax(800).theta(0.9))
    .force("collide", forceCollide<SimNode>((d) => r[d.i] + 4 * room))
    .force("x", forceX<SimNode>((d) => anchor(d.cluster)[0]).strength(0.05))
    .force("y", forceY<SimNode>((d) => anchor(d.cluster)[1]).strength(0.05))
    .stop();
  const ticks = n > 4000 ? 80 : n > 1000 ? 160 : 300;
  for (let i = 0; i < ticks; i++) sim.tick();
  nodes.forEach((d) => {
    x[d.i] = d.x ?? 0;
    y[d.i] = d.y ?? 0;
  });
  return { x, y, r, adj };
}

/** Resolve CSS custom properties (`var(--yellow)`) for canvas drawing. */
function resolver() {
  const css = getComputedStyle(document.documentElement);
  const cache = new Map<string, string>();
  return (value: string) => {
    if (!value.startsWith("var(")) return value;
    let v = cache.get(value);
    if (!v) {
      v = css.getPropertyValue(value.slice(4, -1).trim()).trim() || "#999";
      cache.set(value, v);
    }
    return v;
  };
}

export interface CanvasProps {
  data: GraphData;
  layout: Layout;
  hiddenTypes: Set<string>;
  hiddenKinds: Set<string>;
  matches: Set<number>;
  selected: number | null;
  theme: string;
  onSelect: (i: number | null) => void;
  onOpen: (i: number) => void;
  /** Increment to re-centre on the selection; `fitKey` to fit everything. */
  centerKey: number;
  fitKey: number;
  zoomBy: { k: number; n: number };
}

export function GraphCanvas({ data, layout, hiddenTypes, hiddenKinds, matches, selected, theme, onSelect, onOpen, centerKey, fitKey, zoomBy }: CanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transform = useRef<ZoomTransform>(zoomIdentity);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const hover = useRef<number | null>(null);
  const frame = useRef(0);
  const size = useRef({ w: 800, h: 600 });
  /** Has the reader panned or zoomed? Until then a resize refits the graph. */
  const moved = useRef(false);
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);

  const visible = useMemo(() => {
    const v = new Uint8Array(data.nodes.length);
    data.nodes.forEach((d, i) => (v[i] = hiddenTypes.has(d.wanted ? "wanted" : d.type) ? 0 : 1));
    return v;
  }, [data, hiddenTypes]);

  const edges = useMemo(
    () => data.edges.filter(([s, t, k]) => visible[s] && visible[t] && !hiddenKinds.has(data.kinds[k])),
    [data, visible, hiddenKinds],
  );

  /** Labels are drawn for the highest-ranked nodes first. */
  const byRank = useMemo(() => data.nodes.map((_, i) => i).sort((a, b) => data.nodes[b].rank - data.nodes[a].rank || a - b), [data]);

  /** Uniform grid over graph coordinates for hit testing. */
  const grid = useMemo(() => {
    const cell = 40;
    const map = new Map<string, number[]>();
    for (let i = 0; i < data.nodes.length; i++) {
      const key = `${Math.floor(layout.x[i] / cell)},${Math.floor(layout.y[i] / cell)}`;
      let list = map.get(key);
      if (!list) map.set(key, (list = []));
      list.push(i);
    }
    return { cell, map };
  }, [data, layout]);

  const draw = useRef<() => void>(() => {});
  draw.current = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const color = resolver();
    const ink = color("var(--ink)");
    const muted = color("var(--muted)");
    const card = color("var(--card)");
    const lineSoft = color("var(--line-soft)");
    const pink = color("var(--pink)");
    const { w, h } = size.current;
    const dpr = window.devicePixelRatio || 1;
    const t = transform.current;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const focus = hover.current ?? selected;
    const near = new Set<number>();
    if (focus != null) {
      near.add(focus);
      for (const j of layout.adj[focus]) near.add(j);
    }
    const dim = focus != null;
    // Viewport in graph coordinates, with a margin.
    const x0 = (-t.x - 40) / t.k;
    const y0 = (-t.y - 40) / t.k;
    const x1 = (w - t.x + 40) / t.k;
    const y1 = (h - t.y + 40) / t.k;
    const inView = (i: number) => layout.x[i] >= x0 && layout.x[i] <= x1 && layout.y[i] >= y0 && layout.y[i] <= y1;

    // Edges in three strokes: plain links (soft), typed relations (darker),
    // and the edges of the hovered or selected node (ink, on top).
    const linkKind = data.kinds.indexOf("link");
    const stroke3 = (pick: (s: number, t: number, k: number) => boolean, style: string, alpha: number, width: number) => {
      ctx.beginPath();
      for (const [s, tt, k] of edges) {
        if ((!inView(s) && !inView(tt)) || !pick(s, tt, k)) continue;
        ctx.moveTo(layout.x[s], layout.y[s]);
        ctx.lineTo(layout.x[tt], layout.y[tt]);
      }
      ctx.strokeStyle = style;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width / t.k;
      ctx.stroke();
    };
    const hot = (s: number, tt: number) => dim && (s === focus || tt === focus);
    stroke3((s, tt, k) => !hot(s, tt) && k === linkKind, dim ? lineSoft : muted, dim ? 0.3 : 0.45, 1);
    stroke3((s, tt, k) => !hot(s, tt) && k !== linkKind, dim ? lineSoft : ink, dim ? 0.3 : 0.55, 1.3);
    if (dim) stroke3((s, tt) => hot(s, tt), ink, 0.9, 1.7);
    ctx.globalAlpha = 1;

    // Nodes. Far out, many nodes: small squares batched by colour, no outlines.
    const stroke = 1.5 / Math.max(t.k, 0.6);
    // Coarse mode when many nodes are on screen at once or the view is far out.
    let onScreen = 0;
    if (data.nodes.length > 2000) for (let i = 0; i < data.nodes.length; i++) if (visible[i] && inView(i)) onScreen++;
    const coarse = data.nodes.length > 2000 && (t.k < 0.6 || onScreen > 2500);
    if (coarse) {
      const byColor = new Map<string, number[]>();
      for (let i = 0; i < data.nodes.length; i++) {
        if (!visible[i] || !inView(i)) continue;
        const d = data.nodes[i];
        const c = d.wanted ? muted : color(typeStyle(d.type).color);
        let list = byColor.get(c);
        if (!list) byColor.set(c, (list = []));
        list.push(i);
      }
      for (const [c, list] of byColor) {
        ctx.fillStyle = c;
        for (const dimmed of [true, false]) {
          ctx.globalAlpha = dimmed ? 0.22 : 1;
          ctx.beginPath();
          for (const i of list) {
            if (dim && near.has(i) === dimmed) continue;
            if (!dim && dimmed) continue;
            // Half-size between 1.3 and 4 screen pixels, larger for higher-ranked notes.
            const s = Math.min(4, Math.max(1.3, layout.r[i] * 0.35 * t.k)) / t.k;
            ctx.rect(layout.x[i] - s, layout.y[i] - s, 2 * s, 2 * s);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < data.nodes.length; i++) {
      if (coarse && !(near.has(i) || matches.has(i) || i === selected)) continue;
      if (!visible[i] || !inView(i)) continue;
      const d = data.nodes[i];
      const st = typeStyle(d.wanted ? "wanted" : d.type);
      const r = layout.r[i];
      ctx.globalAlpha = dim && !near.has(i) ? 0.22 : 1;
      ctx.beginPath();
      ctx.lineWidth = stroke;
      if (d.wanted) {
        ctx.setLineDash([2.5, 2]);
        ctx.strokeStyle = muted;
        ctx.fillStyle = card;
        ctx.arc(layout.x[i], layout.y[i], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      ctx.fillStyle = color(st.color);
      ctx.strokeStyle = "#141111";
      if (st.shape === "circle") {
        drawShape(ctx, "circle", layout.x[i], layout.y[i], r);
        ctx.fill();
        ctx.stroke();
      } else {
        drawShape(ctx, st.shape, layout.x[i], layout.y[i], r);
      }
    }
    ctx.globalAlpha = 1;

    // Rings for the selection and search matches.
    const ring = (i: number, c: string, extra: number) => {
      ctx.beginPath();
      ctx.arc(layout.x[i], layout.y[i], layout.r[i] + extra / t.k, 0, Math.PI * 2);
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.5 / t.k;
      ctx.stroke();
    };
    for (const i of matches) if (visible[i]) ring(i, pink, 4);
    if (selected != null && visible[selected]) ring(selected, ink, 5);
    ctx.restore();

    // Labels in screen space so text stays crisp at any zoom.
    ctx.font = '600 12px "Space Grotesk", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';
    ctx.textBaseline = "middle";
    const placed: [number, number, number, number][] = [];
    const budget = Math.round(Math.min(220, 14 * t.k * t.k + 10));
    let shown = 0;
    const label = (i: number, force: boolean) => {
      const sx = layout.x[i] * t.k + t.x;
      const sy = layout.y[i] * t.k + t.y;
      if (sx < -100 || sy < -20 || sx > w + 100 || sy > h + 20) return;
      const text = data.nodes[i].title;
      const tw = ctx.measureText(text).width;
      const lx = sx + layout.r[i] * t.k + 6;
      const box: [number, number, number, number] = [lx - 3, sy - 9, lx + tw + 3, sy + 9];
      if (!force && placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) return;
      placed.push(box);
      ctx.globalAlpha = dim && !near.has(i) ? 0.3 : 1;
      ctx.fillStyle = card;
      ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      ctx.fillStyle = data.nodes[i].wanted ? muted : ink;
      ctx.fillText(text, lx, sy + 0.5);
      shown++;
    };
    const forced = new Set<number>([...matches, ...near]);
    if (selected != null) forced.add(selected);
    for (const i of forced) if (visible[i]) label(i, true);
    for (const i of byRank) {
      if (shown >= budget) break;
      if (!visible[i] || forced.has(i) || data.nodes[i].wanted) continue;
      label(i, false);
    }
    ctx.globalAlpha = 1;

    // Zoomed far out: cluster names over their members.
    if (t.k < 0.55 && data.clusters.length > 1) {
      const sum = new Map<number, [number, number, number]>();
      data.nodes.forEach((d, i) => {
        if (d.cluster < 0 || !visible[i]) return;
        const s = sum.get(d.cluster) ?? [0, 0, 0];
        s[0] += layout.x[i];
        s[1] += layout.y[i];
        s[2] += 1;
        sum.set(d.cluster, s);
      });
      ctx.font = '700 15px "Space Grotesk", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';
      ctx.textAlign = "center";
      for (const c of data.clusters.slice(0, 24)) {
        const s = sum.get(c.id);
        if (!s || s[2] < 3) continue;
        const sx = (s[0] / s[2]) * t.k + t.x;
        const sy = (s[1] / s[2]) * t.k + t.y;
        const tw = ctx.measureText(c.label).width;
        ctx.fillStyle = card;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(sx - tw / 2 - 6, sy - 12, tw + 12, 24);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx - tw / 2 - 6, sy - 12, tw + 12, 24);
        ctx.fillStyle = ink;
        ctx.fillText(c.label, sx, sy + 1);
      }
      ctx.textAlign = "start";
    }
  };

  /** Large graphs: while panning or zooming, move a snapshot of the last full frame; redraw fully once the gesture pauses. */
  const heavy = data.nodes.length > 3000 || data.edges.length > 8000;
  const snapshot = useRef<{ canvas: HTMLCanvasElement; t: ZoomTransform } | null>(null);
  const settle = useRef(0);

  const full = () => {
    draw.current();
    const canvas = canvasRef.current;
    if (!heavy || !canvas) return;
    const snap = snapshot.current?.canvas ?? document.createElement("canvas");
    snap.width = canvas.width;
    snap.height = canvas.height;
    snap.getContext("2d")?.drawImage(canvas, 0, 0);
    snapshot.current = { canvas: snap, t: transform.current };
  };

  const schedule = (moving = false) => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const canvas = canvasRef.current;
      const snap = snapshot.current;
      if (moving && heavy && snap && canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const t = transform.current;
          const k = t.k / snap.t.k;
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.setTransform(k, 0, 0, k, (t.x - snap.t.x * k) * dpr, (t.y - snap.t.y * k) * dpr);
          ctx.drawImage(snap.canvas, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        clearTimeout(settle.current);
        settle.current = window.setTimeout(() => requestAnimationFrame(full), 140);
        return;
      }
      full();
    });
  };

  const hit = (px: number, py: number): number | null => {
    const t = transform.current;
    const gx = (px - t.x) / t.k;
    const gy = (py - t.y) / t.k;
    const cx = Math.floor(gx / grid.cell);
    const cy = Math.floor(gy / grid.cell);
    let best: number | null = null;
    let bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const i of grid.map.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (!visible[i]) continue;
          const d = Math.hypot(layout.x[i] - gx, layout.y[i] - gy);
          const reach = layout.r[i] + 5 / t.k;
          if (d <= reach && d < bestD) {
            best = i;
            bestD = d;
          }
        }
    return best;
  };

  const fit = (animate: boolean) => {
    const canvas = canvasRef.current;
    const z = zoomRef.current;
    if (!canvas || !z) return;
    const idx = data.nodes.map((_, i) => i).filter((i) => visible[i]);
    if (!idx.length) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    if (idx.length > 200) {
      // Large graphs: fit the middle 96% so a few far-off isolated notes do not shrink the rest.
      const xs = idx.map((i) => layout.x[i]).sort((a, b) => a - b);
      const ys = idx.map((i) => layout.y[i]).sort((a, b) => a - b);
      const q = (v: number[], f: number) => v[Math.min(v.length - 1, Math.max(0, Math.floor(f * (v.length - 1))))];
      minX = q(xs, 0.02);
      maxX = q(xs, 0.98);
      minY = q(ys, 0.02);
      maxY = q(ys, 0.98);
      const padX = (maxX - minX) * 0.06;
      const padY = (maxY - minY) * 0.06;
      minX -= padX;
      maxX += padX;
      minY -= padY;
      maxY += padY;
    } else {
      for (const i of idx) {
        minX = Math.min(minX, layout.x[i] - layout.r[i]);
        maxX = Math.max(maxX, layout.x[i] + layout.r[i]);
        minY = Math.min(minY, layout.y[i] - layout.r[i]);
        maxY = Math.max(maxY, layout.y[i] + layout.r[i]);
      }
    }
    const { w, h } = size.current;
    const k = Math.min(2.5, 0.88 * Math.min(w / Math.max(maxX - minX, 1), h / Math.max(maxY - minY, 1)));
    const tr = zoomIdentity.translate(w / 2 - ((minX + maxX) / 2) * k, h / 2 - ((minY + maxY) / 2) * k).scale(k);
    const sel = select(canvas);
    if (animate) sel.transition().duration(450).call(z.transform, tr);
    else sel.call(z.transform, tr);
  };

  const fitRef = useRef(() => fit(false));
  fitRef.current = () => fit(false);

  const center = (i: number) => {
    const canvas = canvasRef.current;
    const z = zoomRef.current;
    if (!canvas || !z) return;
    const { w, h } = size.current;
    const k = Math.max(transform.current.k, 1.1);
    const tr = zoomIdentity.translate(w / 2 - layout.x[i] * k, h / 2 - layout.y[i] * k).scale(k);
    select(canvas).transition().duration(500).call(z.transform, tr);
  };

  // Canvas size follows its box.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      size.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      if (!moved.current && zoomRef.current) fitRef.current();
      schedule();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pan and zoom; pointer events for hover, click and double-click.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const z = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 8])
      .on("zoom", (e) => {
        if (e.sourceEvent) moved.current = true;
        transform.current = e.transform;
        setTip(null);
        schedule(true);
      });
    zoomRef.current = z;
    const sel = select(canvas);
    sel.call(z).on("dblclick.zoom", null);
    fit(false);
    const pos = (e: MouseEvent) => {
      const b = canvas.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top] as const;
    };
    const move = (e: MouseEvent) => {
      const [px, py] = pos(e);
      const i = hit(px, py);
      if (i !== hover.current) {
        hover.current = i;
        canvas.style.cursor = i == null ? "grab" : "pointer";
        schedule();
      }
      setTip(i == null ? null : { i, x: px, y: py });
    };
    const leave = () => {
      hover.current = null;
      setTip(null);
      schedule();
    };
    let down: [number, number] | null = null;
    const pdown = (e: MouseEvent) => (down = [e.clientX, e.clientY]);
    const click = (e: MouseEvent) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
      const [px, py] = pos(e);
      onSelectRef.current(hit(px, py));
    };
    const dbl = (e: MouseEvent) => {
      const [px, py] = pos(e);
      const i = hit(px, py);
      if (i != null) onOpenRef.current(i);
    };
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseleave", leave);
    canvas.addEventListener("mousedown", pdown);
    canvas.addEventListener("click", click);
    canvas.addEventListener("dblclick", dbl);
    return () => {
      sel.on(".zoom", null);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseleave", leave);
      canvas.removeEventListener("mousedown", pdown);
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("dblclick", dbl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, grid, visible]);

  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpen);
  onSelectRef.current = onSelect;
  onOpenRef.current = onOpen;

  useEffect(schedule);
  useEffect(() => {
    if (centerKey && selected != null) center(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);
  useEffect(() => {
    if (fitKey) fit(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);
  useEffect(() => {
    const canvas = canvasRef.current;
    const z = zoomRef.current;
    if (zoomBy.n && canvas && z) select(canvas).transition().duration(250).call(z.scaleBy, zoomBy.k);
  }, [zoomBy]);
  useEffect(() => {
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const tipNode = tip ? data.nodes[tip.i] : null;
  return (
    <div ref={wrapRef} className="graph-canvas">
      <canvas ref={canvasRef} role="img" aria-label={`${data.nodes.length} nodes, ${data.edges.length} edges`} />
      {tip && tipNode ? (
        <div className="graph-tip" style={{ left: Math.min(tip.x + 14, size.current.w - 290), top: tip.y + 14 }}>
          <strong>{tipNode.title}</strong>
          <span className="mono muted">
            {tipNode.wanted ? "wanted" : tipNode.type} · {tipNode.id}
          </span>
        </div>
      ) : null}
    </div>
  );
}
