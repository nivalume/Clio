import { useEffect, useMemo, useState } from "react";
import { GraphCanvas, computeLayout } from "../components/GraphCanvas";
import { TypeTag } from "../components/PixelAvatar";
import { Window } from "../components/Window";
import { boot } from "../lib/boot";
import { getGraph, getManifest } from "../lib/data";
import { strings } from "../lib/i18n";
import { href, navigate } from "../lib/router";
import { typeStyle } from "../lib/styles";
import type { GraphData, Manifest } from "../lib/types";

function toggle<T>(set: Set<T>, v: T): Set<T> {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

export function GraphPage({ lang, focus, theme }: { lang: string; focus: string | null; theme: string }) {
  const t = strings(lang);
  const [data, setData] = useState<GraphData | null>(null);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [error, setError] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [centerKey, setCenterKey] = useState(0);
  const [fitKey, setFitKey] = useState(0);
  const [zoomBy, setZoomBy] = useState({ k: 1, n: 0 });
  const [view, setView] = useState<"graph" | "table">("graph");

  useEffect(() => {
    document.title = `${t.graph} · ${boot.title}`;
    getGraph(lang).then(setData).catch(() => setError(true));
    getManifest(lang).then(setManifest).catch(() => setManifest(null));
  }, [lang, t.graph]);

  const layout = useMemo(() => (data ? computeLayout(data) : null), [data]);
  const index = useMemo(() => new Map((data?.nodes ?? []).map((n, i) => [n.id, i])), [data]);

  // `?focus=` selects a node once the data is in.
  useEffect(() => {
    if (!data || !focus) return;
    const i = index.get(focus);
    if (i != null) {
      setSelected(i);
      setCenterKey((k) => k + 1);
    }
  }, [data, focus, index]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = new Set<number>();
    if (!q || !data) return out;
    data.nodes.forEach((n, i) => {
      if (n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) out.add(i);
    });
    return out;
  }, [query, data]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of data?.nodes ?? []) {
      const ty = n.wanted ? "wanted" : n.type;
      m.set(ty, (m.get(ty) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => (a[0] === "wanted" ? 1 : b[0] === "wanted" ? -1 : b[1] - a[1]));
  }, [data]);

  const kindCounts = useMemo(() => {
    const c = new Array<number>(data?.kinds.length ?? 0).fill(0);
    for (const e of data?.edges ?? []) c[e[2]]++;
    return (data?.kinds ?? []).map((k, i) => [k, c[i]] as const);
  }, [data]);

  const select = (i: number | null) => {
    setSelected(i);
    const id = i == null ? null : data?.nodes[i].id;
    history.replaceState(null, "", href.graph(lang, id));
  };
  const open = (i: number) => {
    const n = data?.nodes[i];
    if (!n) return;
    if (n.wanted) navigate(`${href.health(lang)}#${encodeURIComponent(n.id)}`);
    else navigate(href.note(lang, n.id));
  };

  if (error) return <p className="muted pad">{t.notFound}</p>;
  if (!data || !layout) return <div className="loading" aria-busy="true" />;

  const sel = selected != null ? data.nodes[selected] : null;
  const mi = sel && manifest ? manifest.id.indexOf(sel.id) : -1;
  const neighbours = (() => {
    if (selected == null) return [];
    const groups = new Map<string, number[]>();
    for (const [s, tt, k] of data.edges) {
      const kind = data.kinds[k];
      if (s === selected) {
        const key = `→ ${kind}`;
        groups.set(key, [...(groups.get(key) ?? []), tt]);
      } else if (tt === selected) {
        const key = `← ${kind}`;
        groups.set(key, [...(groups.get(key) ?? []), s]);
      }
    }
    return [...groups.entries()];
  })();

  return (
    <div className="graph-page">
      <Window
        iconColor="var(--cobalt)"
        title={t.view}
        tabs={[
          { id: "graph", label: t.graph },
          { id: "table", label: t.table },
        ]}
        active={view}
        onTab={(id) => setView(id as "graph" | "table")}
        tools={
          <span className="mono muted graph-counts">
            {data.nodes.length} {t.nodes} · {data.edges.length} {t.edges}
          </span>
        }
      >
        <div className="graph-toolbar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches.size) {
                const first = [...matches].sort((a, b) => data.nodes[b].rank - data.nodes[a].rank)[0];
                select(first);
                setCenterKey((k) => k + 1);
              }
            }}
            placeholder={t.filter}
            aria-label={t.filter}
          />
          {query ? <span className="mono muted">{matches.size}</span> : null}
          <span className="graph-toolbar__label">{t.types}</span>
          {typeCounts.map(([ty, count]) => (
            <button
              key={ty}
              type="button"
              className="btn btn--small"
              aria-pressed={!hiddenTypes.has(ty)}
              onClick={() => setHiddenTypes((s) => toggle(s, ty))}
            >
              <span className="swatch" style={{ background: ty === "wanted" ? "transparent" : typeStyle(ty).color }} data-wanted={ty === "wanted" || undefined} />
              {ty === "wanted" ? t.wanted : ty}
              <span className="mono">{count}</span>
            </button>
          ))}
          {kindCounts.length > 1 ? <span className="graph-toolbar__label">{t.relations}</span> : null}
          {kindCounts.length > 1
            ? kindCounts.map(([k, count]) => (
                <button key={k} type="button" className="btn btn--small" aria-pressed={!hiddenKinds.has(k)} onClick={() => setHiddenKinds((s) => toggle(s, k))}>
                  {k}
                  <span className="mono">{count}</span>
                </button>
              ))
            : null}
        </div>
        {view === "graph" ? (
          <div className="graph-stage">
            <GraphCanvas
              data={data}
              layout={layout}
              hiddenTypes={hiddenTypes}
              hiddenKinds={hiddenKinds}
              matches={matches}
              selected={selected}
              theme={theme}
              onSelect={select}
              onOpen={open}
              centerKey={centerKey}
              fitKey={fitKey}
              zoomBy={zoomBy}
            />
            {sel ? (
              <Window
                className="graph-card"
                icon="#"
                iconColor={sel.wanted ? "var(--pebble)" : typeStyle(sel.type).color}
                title={sel.title}
                tools={
                  <button type="button" className="btn btn--small btn--square" onClick={() => select(null)} aria-label={t.close}>
                    ✕
                  </button>
                }
              >
                <div className="graph-card__body">
                  <div className="graph-card__meta">
                    <TypeTag type={sel.wanted ? "wanted" : sel.type} label={sel.wanted ? t.wanted : sel.type} />
                    <span className="tag tag--mono">{sel.id}</span>
                  </div>
                  {mi >= 0 && manifest!.summary[mi] ? <p>{manifest!.summary[mi]}</p> : null}
                  <div className="graph-card__actions">
                    <button type="button" className="btn btn--small btn--action" onClick={() => open(selected!)}>
                      {t.open} →
                    </button>
                    <button type="button" className="btn btn--small" onClick={() => setCenterKey((k) => k + 1)}>
                      ◎
                    </button>
                  </div>
                  {neighbours.length ? (
                    <dl className="graph-card__rels">
                      {neighbours.map(([label, ids]) => (
                        <div key={label}>
                          <dt>
                            {label} <span className="mono muted">{ids.length}</span>
                          </dt>
                          <dd>
                            {ids.slice(0, 30).map((j) => (
                              <button
                                key={j}
                                type="button"
                                className="chip"
                                style={{ background: data.nodes[j].wanted ? "transparent" : typeStyle(data.nodes[j].type).color }}
                                onClick={() => {
                                  select(j);
                                  setCenterKey((k) => k + 1);
                                }}
                              >
                                {data.nodes[j].title}
                              </button>
                            ))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </Window>
            ) : null}
            <div className="graph-hint">{t.hint}</div>
            <div className="graph-zoom">
              <button type="button" className="btn btn--small btn--square" onClick={() => setZoomBy((z) => ({ k: 1.4, n: z.n + 1 }))} aria-label="+">
                +
              </button>
              <button type="button" className="btn btn--small btn--square" onClick={() => setZoomBy((z) => ({ k: 1 / 1.4, n: z.n + 1 }))} aria-label="−">
                −
              </button>
              <button type="button" className="btn btn--small" onClick={() => setFitKey((k) => k + 1)}>
                {t.fit}
              </button>
            </div>
          </div>
        ) : (
          <GraphTable data={data} lang={lang} hiddenTypes={hiddenTypes} query={query} />
        )}
      </Window>
    </div>
  );
}

type SortKey = "title" | "type" | "rank" | "in" | "out" | "cluster";

function GraphTable({ data, lang, hiddenTypes, query }: { data: GraphData; lang: string; hiddenTypes: Set<string>; query: string }) {
  const [sort, setSort] = useState<SortKey>("rank");
  const degree = useMemo(() => {
    const inn = new Array<number>(data.nodes.length).fill(0);
    const out = new Array<number>(data.nodes.length).fill(0);
    for (const [s, tt] of data.edges) {
      out[s]++;
      inn[tt]++;
    }
    return { in: inn, out };
  }, [data]);
  const clusterName = useMemo(() => new Map(data.clusters.map((c) => [c.id, c.label])), [data]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const idx = data.nodes
      .map((_, i) => i)
      .filter((i) => !hiddenTypes.has(data.nodes[i].wanted ? "wanted" : data.nodes[i].type))
      .filter((i) => !q || data.nodes[i].title.toLowerCase().includes(q) || data.nodes[i].id.toLowerCase().includes(q));
    const n = data.nodes;
    const cmp: Record<SortKey, (a: number, b: number) => number> = {
      title: (a, b) => n[a].title.localeCompare(n[b].title, lang),
      type: (a, b) => n[a].type.localeCompare(n[b].type) || n[b].rank - n[a].rank,
      rank: (a, b) => n[b].rank - n[a].rank || a - b,
      in: (a, b) => degree.in[b] - degree.in[a] || a - b,
      out: (a, b) => degree.out[b] - degree.out[a] || a - b,
      cluster: (a, b) => n[a].cluster - n[b].cluster || n[b].rank - n[a].rank,
    };
    return idx.sort(cmp[sort]).slice(0, 2000);
  }, [data, hiddenTypes, query, sort, degree, lang]);
  const head = (k: SortKey, label: string) => (
    <th aria-sort={sort === k ? "descending" : undefined}>
      <button type="button" className="th-sort" onClick={() => setSort(k)}>
        {label}
        {sort === k ? " ↓" : ""}
      </button>
    </th>
  );
  return (
    <div className="graph-table">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {head("title", "title")}
              {head("type", "type")}
              {head("rank", "rank")}
              {head("in", "in")}
              {head("out", "out")}
              {head("cluster", "cluster")}
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const d = data.nodes[i];
              return (
                <tr key={d.id}>
                  <td>{d.wanted ? <span className="muted">{d.title}</span> : <a href={href.note(lang, d.id)}>{d.title}</a>}</td>
                  <td>
                    <TypeTag type={d.wanted ? "wanted" : d.type} />
                  </td>
                  <td className="mono">{d.rank.toFixed(4)}</td>
                  <td className="mono">{degree.in[i]}</td>
                  <td className="mono">{degree.out[i]}</td>
                  <td>{d.cluster >= 0 ? clusterName.get(d.cluster) ?? d.cluster : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
