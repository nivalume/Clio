import { boot } from "../lib/boot";
import { LANG_NAMES, strings } from "../lib/i18n";
import { href, navigate, type Route } from "../lib/router";
import type { Theme } from "../lib/theme";

export function TopBar({
  route,
  theme,
  onTheme,
  onSearch,
  onMenu,
  menuOpen,
  langHref,
}: {
  route: Route;
  theme: Theme;
  onTheme: () => void;
  onSearch: () => void;
  onMenu?: () => void;
  menuOpen: boolean;
  langHref: (lang: string) => string;
}) {
  const t = strings(route.lang);
  const at = (name: Route["name"]) => (route.name === name ? "page" : undefined);
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return (
    <header className="topbar">
      {onMenu ? (
        <button type="button" className="btn btn--small btn--square menu-button" onClick={onMenu} aria-label={t.menu} aria-expanded={menuOpen}>
          {menuOpen ? "✕" : "☰"}
        </button>
      ) : null}
      <a className="brand" href={href.home(route.lang)}>
        <span className="brand__mark">{boot.title}</span>
        <span className="brand__sub">/ KNOWLEDGE BASE</span>
      </a>
      <nav className="topbar__nav" aria-label="main">
        <a className="topbar__link" href={href.explore(route.lang)} aria-current={at("explore")}>
          {t.explore}
        </a>
        <a className="topbar__link" href={href.graph(route.lang)} aria-current={at("graph")}>
          {t.graph}
        </a>
        <a className="topbar__link" href={href.tags(route.lang)} aria-current={at("tags")}>
          {t.tags}
        </a>
        <a className="topbar__link" href={href.health(route.lang)} aria-current={at("health")}>
          {t.health}
        </a>
        <button type="button" className="btn btn--small" onClick={onSearch} aria-label={t.search}>
          <span aria-hidden="true">⌕</span>
          <span className="hide-narrow">{t.search}</span>
          <span className="kbd hide-narrow">{isMac ? "⌘K" : "Ctrl K"}</span>
        </button>
        {boot.locales.length > 1 ? (
          <span className="segmented" role="group" aria-label={t.language}>
            {boot.locales.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={l === route.lang}
                title={LANG_NAMES[l] ?? l}
                onClick={() => {
                  try {
                    localStorage.setItem("clio-lang", l);
                  } catch {
                    /* private mode */
                  }
                  navigate(langHref(l));
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </span>
        ) : null}
        <button type="button" className="btn btn--small btn--square" onClick={onTheme} aria-label={t.theme} title={t.theme}>
          {theme === "dark" ? "☀" : "☾"}
        </button>
        {boot.repo ? (
          <a className="btn btn--small btn--pink hide-narrow" href={boot.repo} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        ) : null}
      </nav>
    </header>
  );
}
