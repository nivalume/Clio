import { useEffect, useState } from "react";
import { getSite } from "../lib/data";
import { strings } from "../lib/i18n";
import { href } from "../lib/router";
import type { SiteData } from "../lib/types";
import { Window } from "./Window";
import { typeStyle } from "../lib/styles";

/** Navigation for note pages: views, hubs and types. Never a list of every note. */
export function Sidebar({ lang, current, onSearch }: { lang: string; current?: string; onSearch: () => void }) {
  const t = strings(lang);
  const [site, setSite] = useState<SiteData | null>(null);
  useEffect(() => {
    getSite(lang).then(setSite).catch(() => setSite(null));
  }, [lang]);
  return (
    <Window as="nav" className="channels" title={site?.title ?? "Clio"} subtitle={site ? `${site.stats.notes} ${t.notes}` : ""}>
      <button type="button" className="channels__search" onClick={onSearch}>
        <span aria-hidden="true">⌕</span>
        <span>{t.searchPlaceholder}</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>
          /
        </span>
      </button>
      <div className="channels__list">
        <a className="channel" href={href.home(lang)}>
          <span className="channel__hash">~</span>
          <span>{t.home}</span>
        </a>
        <a className="channel" href={href.explore(lang)}>
          <span className="channel__hash">≡</span>
          <span>{t.explore}</span>
        </a>
        <a className="channel" href={href.graph(lang, current)}>
          <span className="channel__hash">◎</span>
          <span>{t.graph}</span>
        </a>
        <a className="channel" href={href.tags(lang)}>
          <span className="channel__hash">#</span>
          <span>{t.tags}</span>
        </a>
        <a className="channel" href={href.health(lang)}>
          <span className="channel__hash">!</span>
          <span>{t.health}</span>
          {site && site.lint.errors + site.stats.wanted ? <span className="channel__count mono">{site.lint.errors + site.stats.wanted}</span> : null}
        </a>
        {site?.hubs.length ? (
          <div className="channels__group">
            <div className="channels__heading">
              <span className="swatch" style={{ background: "var(--cobalt)" }} />
              <span>{t.hubs}</span>
              <span className="count">{site.hubs.length}</span>
            </div>
            {site.hubs.map((h) => (
              <a key={h.id} className="channel" href={h.url} aria-current={h.id === current ? "page" : undefined} title={h.summary}>
                <span className="channel__hash">#</span>
                <span>{h.title}</span>
              </a>
            ))}
          </div>
        ) : null}
        {site ? (
          <div className="channels__group">
            <div className="channels__heading">
              <span className="swatch" style={{ background: "var(--sky)" }} />
              <span>{t.types}</span>
            </div>
            {site.types
              .filter((ty) => ty.count > 0)
              .map((ty) => (
                <a key={ty.name} className="channel" href={href.explore(lang, { type: ty.name })}>
                  <span className="channel__swatch" style={{ background: typeStyle(ty.name).color }} />
                  <span>{ty.label}</span>
                  <span className="channel__count mono">{ty.count}</span>
                </a>
              ))}
          </div>
        ) : null}
      </div>
    </Window>
  );
}
