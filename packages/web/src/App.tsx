import { useCallback, useEffect, useState } from "react";
import { CommandPalette } from "./components/CommandPalette";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Window } from "./components/Window";
import { boot } from "./lib/boot";
import type { NoteDoc } from "./lib/data";
import { strings } from "./lib/i18n";
import { href, prefix, useRoute, type Route } from "./lib/router";
import { useTheme } from "./lib/theme";
import { ExplorePage } from "./pages/Explore";
import { GraphPage } from "./pages/Graph";
import { HealthPage } from "./pages/Health";
import { HomePage } from "./pages/Home";
import { NotePage, NoteRail } from "./pages/Note";
import { TagsPage } from "./pages/Tags";

/** The same place in another language: every route keeps its path after the language prefix. */
function langHref(route: Route, lang: string): string {
  const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const from = prefix(route.lang);
  if (here.startsWith(from)) return `${prefix(lang)}${here.slice(from.length)}`;
  return href.home(lang);
}

function NotFound({ lang }: { lang: string }) {
  const t = strings(lang);
  useEffect(() => {
    document.title = `404 · ${boot.title}`;
  }, []);
  return (
    <div className="empty-state">
      <Window dotted icon="?" iconColor="var(--red)" title="404" subtitle={window.location.pathname}>
        <div className="window__body">
          <p>{t.notFound}</p>
          <a className="btn btn--pink" href={href.home(lang)}>
            ← {t.backHome}
          </a>
        </div>
      </Window>
    </div>
  );
}

export function App() {
  const route = useRoute();
  const [theme, toggleTheme] = useTheme();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [doc, setDoc] = useState<NoteDoc | null>(null);
  const t = strings(route.lang);
  const openSearch = useCallback(() => setPalette(true), []);

  useEffect(() => {
    document.documentElement.lang = route.lang;
  }, [route.lang]);

  // Close the drawer whenever the page changes.
  const where = route.name === "note" ? route.url : route.name;
  useEffect(() => setDrawer(false), [where]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable='true']");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((p) => !p);
      } else if (e.key === "/" && !typing && !palette) {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === "Escape" && drawer) {
        setDrawer(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [palette, drawer]);

  const side = (wideToo: boolean) => (
    <>
      <div className={`shell__side${wideToo ? "" : " drawer-only"}`} data-open={drawer}>
        <Sidebar lang={route.lang} current={route.name === "note" ? doc?.page.id : undefined} onSearch={openSearch} />
      </div>
      <div className="drawer-backdrop" data-open={drawer} onClick={() => setDrawer(false)} />
    </>
  );

  let body;
  switch (route.name) {
    case "home":
      body = (
        <>
          {side(false)}
          <HomePage lang={route.lang} onSearch={openSearch} />
        </>
      );
      break;
    case "note":
      body = (
        <div className="shell">
          {side(true)}
          <main className="shell__main" id="main">
            <NotePage url={route.url} lang={route.lang} hash={route.hash} onLoaded={setDoc} />
          </main>
          <aside className="shell__rail" aria-label={t.relations}>
            <NoteRail doc={doc} lang={route.lang} />
          </aside>
        </div>
      );
      break;
    case "graph":
      body = (
        <>
          {side(false)}
          <main id="main">
            <GraphPage lang={route.lang} focus={route.focus} theme={theme} />
          </main>
        </>
      );
      break;
    case "explore":
    case "tags":
    case "health":
      body = (
        <div className="shell shell--two">
          {side(true)}
          <main className="shell__main" id="main">
            {route.name === "explore" ? (
              <ExplorePage lang={route.lang} params={route.params} />
            ) : route.name === "tags" ? (
              <TagsPage lang={route.lang} tag={route.tag} />
            ) : (
              <HealthPage lang={route.lang} />
            )}
          </main>
        </div>
      );
      break;
    default:
      body = (
        <>
          {side(false)}
          <NotFound lang={route.lang} />
        </>
      );
  }

  return (
    <>
      <a className="skip-link" href="#main">
        {t.skip}
      </a>
      <TopBar
        route={route}
        theme={theme}
        onTheme={toggleTheme}
        onSearch={openSearch}
        onMenu={() => setDrawer((d) => !d)}
        menuOpen={drawer}
        langHref={(l) => langHref(route, l)}
      />
      {body}
      <footer className="site-foot">
        <span>
          <a href="https://github.com/nivalume/Clio" target="_blank" rel="noreferrer">
            {t.poweredBy}
          </a>
        </span>
        {boot.generated ? (
          <span className="mono muted">
            {t.generated} {boot.generated}
          </span>
        ) : null}
      </footer>
      {palette ? <CommandPalette lang={route.lang} onClose={() => setPalette(false)} /> : null}
    </>
  );
}
