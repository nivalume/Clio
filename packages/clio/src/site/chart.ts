/**
 * ```chart blocks → static SVG at build time.
 *
 * Input is YAML (`type: bar|line`, `title`, `x: [...]`, `series: [{name, data}]`,
 * optional `unit`, `height`) or CSV with a header row (first column = x).
 * Bars start at zero; one y axis; series colours come from --series-N (a
 * colour-blind-checked order defined in the site CSS); each mark has a
 * <title> tooltip and the data is repeated in a table under the chart.
 */
import { escape } from "./html";

export interface ChartSpec {
  type: "bar" | "line";
  title?: string;
  x: string[];
  series: { name: string; data: (number | null)[] }[];
  unit?: string;
  height?: number;
}

const W = 640;

function parseCsv(src: string): ChartSpec | null {
  const rows = src
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((c) => c.trim()));
  if (rows.length < 2 || rows[0].length < 2) return null;
  const [head, ...body] = rows;
  return {
    type: "bar",
    x: body.map((r) => r[0]),
    series: head.slice(1).map((name, j) => ({ name, data: body.map((r) => num(r[j + 1])) })),
  };
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,_\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseChart(src: string): ChartSpec {
  let doc: unknown = null;
  try {
    doc = Bun.YAML.parse(src);
  } catch {
    doc = null;
  }
  if (doc && typeof doc === "object" && !Array.isArray(doc) && ("series" in doc || "data" in doc)) {
    const d = doc as Record<string, any>;
    const rawSeries: any[] = Array.isArray(d.series) ? d.series : [{ name: d.name ?? "", data: d.data }];
    const series = rawSeries.map((s, i) => ({
      name: String(s?.name ?? `series ${i + 1}`),
      data: (Array.isArray(s?.data) ? s.data : []).map(num),
    }));
    const len = Math.max(0, ...series.map((s) => s.data.length));
    const x = Array.isArray(d.x) ? d.x.map(String) : Array.from({ length: len }, (_, i) => String(i + 1));
    return {
      type: d.type === "line" ? "line" : "bar",
      title: d.title ? String(d.title) : undefined,
      x,
      series,
      unit: d.unit ? String(d.unit) : undefined,
      height: Number(d.height) > 120 ? Math.min(Number(d.height), 800) : undefined,
    };
  }
  const csv = parseCsv(src);
  if (csv) return csv;
  throw new Error("expected YAML with `series` (or `data`), or CSV with a header row");
}

/** About five round tick values covering [lo, hi]. */
function ticks(lo: number, hi: number): number[] {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  if (out[out.length - 1] < hi) out.push(Number((out[out.length - 1] + step).toPrecision(12)));
  return out;
}

function fmt(v: number, unit = ""): string {
  const abs = Math.abs(v);
  const s = abs >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : abs >= 1e4 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(2)}`;
  return `${s}${unit}`;
}

/** A bar with 4px rounded corners on its data end and a square end on the baseline. */
function barPath(x: number, w: number, y0: number, y1: number): string {
  const h = Math.abs(y1 - y0);
  const r = Math.min(4, w / 2, h);
  if (y1 <= y0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
}

export function renderChart(src: string, fallbackTitle?: string | null): string {
  let spec: ChartSpec;
  try {
    spec = parseChart(src);
  } catch (e) {
    return `<pre class="chart-source" title="${escape(String(e instanceof Error ? e.message : e))}">${escape(src)}</pre>`;
  }
  const title = spec.title ?? fallbackTitle ?? undefined;
  const H = spec.height ?? 280;
  const values = spec.series.flatMap((s) => s.data).filter((v): v is number => v !== null);
  const vmin = values.length ? Math.min(...values) : 0;
  const vmax = values.length ? Math.max(...values) : 1;
  // Bars always include zero; lines too unless they go negative.
  const tk = ticks(Math.min(0, vmin), Math.max(0, vmax));
  const yMin = tk[0];
  const yMax = tk[tk.length - 1];
  const labelW = Math.max(...tk.map((t) => fmt(t, spec.unit).length)) * 7 + 14;
  const direct = spec.type === "line" && spec.series.length >= 2 && spec.series.length <= 4;
  const m = { l: labelW, r: direct ? 96 : 14, t: 14, b: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const y = (v: number) => m.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
  const n = spec.x.length;
  const band = iw / Math.max(n, 1);
  const cx = (i: number) => m.l + band * (i + 0.5);
  const parts: string[] = [];

  // Grid and y labels: recessive.
  for (const t of tk) {
    const yy = y(t).toFixed(1);
    parts.push(`<line class="${t === 0 ? "chart-axis" : "chart-grid"}" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`);
    parts.push(`<text x="${m.l - 8}" y="${yy}" text-anchor="end" dominant-baseline="middle">${escape(fmt(t, spec.unit))}</text>`);
  }
  // X labels, thinned when crowded.
  const every = Math.max(1, Math.ceil((n * 46) / iw));
  spec.x.forEach((label, i) => {
    if (i % every) return;
    const text = label.length > 12 ? `${label.slice(0, 11)}…` : label;
    parts.push(`<text x="${cx(i).toFixed(1)}" y="${H - m.b + 18}" text-anchor="middle">${escape(text)}</text>`);
  });

  const color = (j: number) => `var(--series-${(j % 8) + 1})`;
  if (spec.type === "bar") {
    const k = spec.series.length;
    const gap = 2;
    const group = band * 0.72;
    const bw = Math.max(2, (group - gap * (k - 1)) / Math.max(k, 1));
    spec.series.forEach((s, j) => {
      s.data.forEach((v, i) => {
        if (v === null || i >= n) return;
        const x = cx(i) - group / 2 + j * (bw + gap);
        parts.push(
          `<path d="${barPath(+x.toFixed(1), +bw.toFixed(1), +y(0).toFixed(1), +y(v).toFixed(1))}" style="fill:${color(j)}"><title>${escape(`${s.name ? `${s.name} · ` : ""}${spec.x[i]}: ${fmt(v, spec.unit)}`)}</title></path>`,
        );
      });
    });
  } else {
    spec.series.forEach((s, j) => {
      let d = "";
      let pen = false;
      s.data.forEach((v, i) => {
        if (v === null || i >= n) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${cx(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      });
      parts.push(`<path d="${d}" fill="none" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" style="stroke:${color(j)}"/>`);
      s.data.forEach((v, i) => {
        if (v === null || i >= n) return;
        parts.push(
          `<circle cx="${cx(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" stroke-width="2" style="fill:${color(j)};stroke:var(--card)"><title>${escape(`${s.name ? `${s.name} · ` : ""}${spec.x[i]}: ${fmt(v, spec.unit)}`)}</title></circle>`,
        );
      });
      if (direct) {
        const last = s.data.map((v, i) => [v, i] as const).filter(([v, i]) => v !== null && i < n).pop();
        if (last) parts.push(`<text class="chart-value" x="${(cx(last[1]) + 10).toFixed(1)}" y="${y(last[0]!).toFixed(1)}" dominant-baseline="middle">${escape(s.name)}</text>`);
      }
    });
  }

  const label = title ?? spec.series.map((s) => s.name).join(", ");
  const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(label)}">${parts.join("")}</svg>`;
  const legend =
    spec.series.length >= 2
      ? `<div class="chart-legend">${spec.series.map((s, j) => `<span><i style="background:${color(j)}"></i>${escape(s.name)}</span>`).join("")}</div>`
      : "";
  const table = `<details class="chart-table"><summary>data</summary><div class="table-wrap"><table><thead><tr><th></th>${spec.series
    .map((s) => `<th>${escape(s.name)}</th>`)
    .join("")}</tr></thead><tbody>${spec.x
    .map((xl, i) => `<tr><td>${escape(xl)}</td>${spec.series.map((s) => `<td>${s.data[i] === null || s.data[i] === undefined ? "" : escape(fmt(s.data[i]!, spec.unit))}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div></details>`;
  return `<figure class="chart" data-type="${spec.type}">${title ? `<figcaption>${escape(title)}</figcaption>` : ""}${svg}${legend}${table}</figure>`;
}
