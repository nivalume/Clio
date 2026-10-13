import { useEffect, useState } from "react";
import { Article } from "../components/Article";
import { PixelAvatar } from "../components/PixelAvatar";
import { Window } from "../components/Window";
import { boot } from "../lib/boot";
import { getSite } from "../lib/data";
import { strings } from "../lib/i18n";
import { href } from "../lib/router";
import { typeStyle } from "../lib/styles";
import type { SiteData } from "../lib/types";

const STICKERS = [
  { type: "topic", style: { top: -30, left: -26, transform: "rotate(-8deg)" } },
  { type: "concept", style: { top: 70, right: -30, transform: "rotate(7deg)" } },
  { type: "source", style: { bottom: 58, left: -34, transform: "rotate(5deg)" } },
  { type: "question", style: { bottom: -28, right: 48, transform: "rotate(-6deg)" } },
];

export function HomePage({ lang, onSearch }: { lang: string; onSearch: () => void }) {
  const t = strings(lang);
  const [site, setSite] = useState<SiteData | null>(null);
  useEffect(() => {
    getSite(lang).then((s) => {
      setSite(s);
      document.title = s.title;
    });
  }, [lang]);
  if (!site) return <div className="loading" aria-busy="true" />;
  const feed = (site.hubs.length ? site.hubs : site.recent).slice(0, 6);

  return (
    <>
      <section className="hero">
        <div>
          <span className="tag tag--mono hero__kicker">● {site.stats.notes} {t.notes} · {site.stats.edges} {t.links}</span>
          <h1>
            <span className="marker">{site.title}</span>
          </h1>
          <p>{boot.description || t.heroLead}</p>
          <button type="button" className="hero-search" onClick={onSearch}>
            <span aria-hidden="true">⌕</span>
            <span>{t.searchPlaceholder}</span>
            <span className="kbd">/</span>
          </button>
          <div className="hero__cta">
            <a className="btn btn--pink" href={href.explore(lang)}>
              {t.openExplore} →
            </a>
            <a className="btn btn--yellow" href={href.graph(lang)}>
              ◎ {t.graph}
            </a>
            <a className="btn" href={href.tags(lang)}>
              # {t.tags}
            </a>
          </div>
        </div>
        <div className="hero__stage">
          {STICKERS.map((s) => (
            <div key={s.type} className="sticker" style={{ ...s.style, background: typeStyle(s.type).color }} aria-hidden="true">
              <PixelAvatar type={s.type} size={50} />
            </div>
          ))}
          <Window dotted icon="#" title={site.hubs.length ? t.hubs : t.recent} subtitle={`${site.stats.notes} ${t.notes}`}>
            <div className="chat hero-feed">
              {feed.map((h, i) => (
                <a key={h.id} className="msg" href={h.url}>
                  <PixelAvatar type={h.type} online={i % 3 !== 2} />
                  <div style={{ minWidth: 0 }}>
                    <div className="msg__head">
                      <span className="msg__name">{h.title}</span>
                      <span className="msg__time">
                        {h.type} · #{h.id}
                      </span>
                    </div>
                    <div className="msg__text">{h.summary}</div>
                  </div>
                </a>
              ))}
            </div>
          </Window>
        </div>
      </section>

      <section className="band band--compact">
        <div className="stats">
          <span className="tag">
            {site.stats.notes} {t.notes}
          </span>
          <span className="tag">
            {site.stats.edges} {t.links}
          </span>
          <span className="tag">
            {site.stats.words.toLocaleString()} {t.words}
          </span>
          {site.types
            .filter((ty) => ty.count)
            .map((ty) => (
              <a key={ty.name} className="tag" style={{ background: typeStyle(ty.name).color }} href={href.explore(lang, { type: ty.name })}>
                {ty.label} {ty.count}
              </a>
            ))}
          {site.stats.wanted ? (
            <a className="tag tag--wanted" href={href.health(lang)}>
              {t.wanted} {site.stats.wanted}
            </a>
          ) : null}
        </div>
      </section>

      {site.index?.html ? (
        <section className="section section--narrow">
          <Window icon="#" title={<span className="mono">index</span>} subtitle={site.index.title}>
            <div className="page-body">
              <Article html={site.index.html} lang={lang} />
            </div>
          </Window>
        </section>
      ) : null}

      {site.clusters.length ? (
        <section className="section">
          <h2>{t.clusters}</h2>
          <div className="cluster-grid">
            {site.clusters.slice(0, 12).map((c) => (
              <Window key={c.id} icon="◎" iconColor="var(--lavender)" title={c.label} subtitle={`${c.size} ${t.members}`}>
                <div className="chat">
                  {c.members.slice(0, 5).map((m) => (
                    <a key={m.id} className="msg msg--compact" href={m.url}>
                      <PixelAvatar type={m.type} size={24} />
                      <div style={{ minWidth: 0 }}>
                        <div className="msg__head">
                          <span className="msg__name">{m.title}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="window__foot">
                  <a href={href.graph(lang, c.members[0]?.id)}>{t.openGraph} →</a>
                </div>
              </Window>
            ))}
          </div>
        </section>
      ) : null}

      {site.recent.length ? (
        <section className="section">
          <h2>{t.recent}</h2>
          <Window icon="↻" iconColor="var(--lime)" title={t.recent}>
            <div className="chat">
              {site.recent.map((r) => (
                <a key={r.id} className="msg" href={r.url}>
                  <PixelAvatar type={r.type} />
                  <div style={{ minWidth: 0 }}>
                    <div className="msg__head">
                      <span className="msg__name">{r.title}</span>
                      <span className="msg__time">{r.updated}</span>
                    </div>
                    <div className="msg__text">{r.summary}</div>
                  </div>
                </a>
              ))}
            </div>
          </Window>
        </section>
      ) : null}
    </>
  );
}
