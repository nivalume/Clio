import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { getSite } from "../lib/data";
import { strings } from "../lib/i18n";
import { navigate } from "../lib/router";
import { textSearch, titleSearch, type Hit } from "../lib/search";
import { PixelAvatar } from "./PixelAvatar";
import { Window } from "./Window";

/** Pagefind excerpts mark hits with <mark>; everything else in them is escaped text. */
function Excerpt({ html }: { html: string }) {
  const safe = html.replace(/<(?!\/?mark>)[^>]*>/g, "");
  return <div className="msg__text" dangerouslySetInnerHTML={{ __html: safe }} />;
}

export function CommandPalette({ lang, onClose }: { lang: string; onClose: () => void }) {
  const t = strings(lang);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [starters, setStarters] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSite(lang)
      .then((s) => setStarters(s.hubs.slice(0, 7).map((h) => ({ id: h.id, title: h.title, type: h.type, url: h.url, excerpt: h.summary, via: "title" }))))
      .catch(() => setStarters([]));
  }, [lang]);

  useEffect(() => {
    let live = true;
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    titleSearch(lang, q).then((titles) => {
      if (!live) return;
      setHits(titles);
      textSearch(q).then((texts) => {
        if (!live) return;
        const seen = new Set(titles.map((h) => h.url));
        setHits([...titles, ...texts.filter((h) => !seen.has(h.url))]);
      });
    });
    return () => {
      live = false;
    };
  }, [query, lang]);

  const list = query.trim() ? hits : starters;
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    inputRef.current?.focus();
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);
  useEffect(() => {
    listRef.current?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const open = (h: Hit | undefined) => {
    if (!h) return;
    onClose();
    navigate(h.url);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, list.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(list[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab") {
      e.preventDefault();
    }
  };
  const label = useMemo(() => (query.trim() ? `${hits.length} ${t.results}` : t.startHere), [query, hits.length, t]);

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t.search} onKeyDown={onKey}>
        <Window
          icon="⌕"
          iconColor="var(--pink)"
          className="palette__window"
          title={
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              aria-label={t.search}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              autoComplete="off"
              spellCheck={false}
            />
          }
          tools={<span className="kbd">esc</span>}
        >
          <div className="palette__label mono muted">{label}</div>
          <div className="palette__results chat" id="palette-results" role="listbox" ref={listRef}>
            {query.trim() && hits.length === 0 ? <div className="palette__empty">{t.noResults}</div> : null}
            {list.map((h, i) => (
              <a
                key={`${h.via}:${h.url}`}
                className="msg"
                role="option"
                aria-selected={i === active}
                href={h.url}
                onMouseMove={() => setActive(i)}
                onClick={(e) => {
                  e.preventDefault();
                  open(h);
                }}
              >
                <PixelAvatar type={h.type} />
                <div style={{ minWidth: 0 }}>
                  <div className="msg__head">
                    <span className="msg__name">{h.title}</span>
                    <span className="msg__time">
                      {h.type} · {h.via === "title" ? "title" : "text"}
                    </span>
                  </div>
                  {h.via === "text" ? <Excerpt html={h.excerpt} /> : <div className="msg__text">{h.excerpt}</div>}
                </div>
              </a>
            ))}
          </div>
          <div className="palette__foot mono muted">
            <span>
              <span className="kbd">↑</span> <span className="kbd">↓</span>
            </span>
            <span>
              <span className="kbd">enter</span> {t.open}
            </span>
            <span>
              <span className="kbd">esc</span> {t.close}
            </span>
          </div>
        </Window>
      </div>
    </div>
  );
}
