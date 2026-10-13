import { useEffect, useMemo, useState } from "react";
import { PixelAvatar, TypeTag } from "../components/PixelAvatar";
import { VirtualList } from "../components/VirtualList";
import { Window } from "../components/Window";
import { getManifest, getSite } from "../lib/data";
import { strings } from "../lib/i18n";
import { href, navigate } from "../lib/router";
import type { Manifest, SiteData } from "../lib/types";

type Sort = "rank" | "updated" | "title";

export function ExplorePage({ lang, params }: { lang: string; params: URLSearchParams }) {
  const t = strings(lang);
  const [m, setM] = useState<Manifest | null>(null);
  const [site, setSite] = useState<SiteData | null>(null);
  const type = params.get("type") ?? "";
  const tag = params.get("tag") ?? "";
  const status = params.get("status") ?? "";
  const sort = (params.get("sort") as Sort) || "rank";
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    getManifest(lang).then(setM);
    getSite(lang).then(setSite);
    document.title = `${t.explore}`;
  }, [lang, t.explore]);

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    navigate(href.explore(lang, Object.fromEntries(next)), true);
  };

  const rows = useMemo(() => {
    if (!m) return [];
    const needle = q.trim().toLowerCase();
    const tagIdx = tag ? m.tags.map((x, i) => (x === tag || x.startsWith(`${tag}/`) ? i : -1)).filter((i) => i >= 0) : [];
    const out: number[] = [];
    for (let i = 0; i < m.id.length; i++) {
      if (type && m.types[m.type[i]] !== type) continue;
      if (status && m.status[i] !== status) continue;
      if (tag && !m.tagIds[i].some((x) => tagIdx.includes(x))) continue;
      if (needle && !m.title[i].toLowerCase().includes(needle) && !m.id[i].toLowerCase().includes(needle)) continue;
      out.push(i);
    }
    const cmp: Record<Sort, (a: number, b: number) => number> = {
      rank: (a, b) => m.rank[b] - m.rank[a],
      updated: (a, b) => (m.updated[b] ?? "").localeCompare(m.updated[a] ?? ""),
      title: (a, b) => m.title[a].localeCompare(m.title[b], lang),
    };
    return out.sort((a, b) => cmp[sort](a, b) || a - b);
  }, [m, type, tag, status, sort, q, lang]);

  if (!m || !site) return <div className="loading" aria-busy="true" />;
  const statuses = [...new Set(m.status.filter(Boolean) as string[])].sort();

  return (
    <div className="wide-page">
      <Window icon="≡" iconColor="var(--lime)" title={t.explore} subtitle={`${rows.length} / ${m.id.length}`}>
        <div className="filter-bar" role="toolbar">
          <button type="button" className="btn btn--small" aria-pressed={!type} onClick={() => set("type", "")}>
            {t.all}
          </button>
          {site.types
            .filter((x) => x.count)
            .map((x) => (
              <button key={x.name} type="button" className="btn btn--small" aria-pressed={type === x.name} onClick={() => set("type", type === x.name ? "" : x.name)}>
                <TypeTag type={x.name} label={x.label} /> <span className="mono">{x.count}</span>
              </button>
            ))}
          <span className="sep" />
          <select value={tag} onChange={(e) => set("tag", e.target.value)} aria-label={t.tags}>
            <option value="">#{t.tags}</option>
            {site.tags.slice(0, 200).map(([name, n]) => (
              <option key={name} value={name}>
                #{name} ({n})
              </option>
            ))}
          </select>
          {statuses.length ? (
            <select value={status} onChange={(e) => set("status", e.target.value)} aria-label={t.status}>
              <option value="">{t.status}</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          ) : null}
          <select value={sort} onChange={(e) => set("sort", e.target.value)} aria-label="sort">
            <option value="rank">{t.sortRank}</option>
            <option value="updated">{t.sortUpdated}</option>
            <option value="title">{t.sortTitle}</option>
          </select>
          <input type="search" value={q} placeholder={t.filter} onChange={(e) => setQ(e.target.value)} aria-label={t.filter} />
        </div>
        {rows.length ? (
          <VirtualList
            count={rows.length}
            rowHeight={66}
            render={(k) => {
              const i = rows[k];
              return (
                <a className="msg explore-row" href={href.note(lang, m.id[i])}>
                  <PixelAvatar type={m.types[m.type[i]]} />
                  <div style={{ minWidth: 0 }}>
                    <div className="msg__head">
                      <span className="msg__name">{m.title[i]}</span>
                      <span className="msg__time">
                        {m.types[m.type[i]]}
                        {m.updated[i] ? ` · ${m.updated[i]}` : ""} · ↙{m.in[i]} ↗{m.out[i]}
                      </span>
                    </div>
                    <div className="msg__text msg__text--one">{m.summary[i]}</div>
                  </div>
                </a>
              );
            }}
          />
        ) : (
          <p className="muted pad">{t.noResults}</p>
        )}
      </Window>
    </div>
  );
}
