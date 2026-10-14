import { useEffect, useState } from "react";
import { Article } from "../components/Article";
import { LocalGraph } from "../components/LocalGraph";
import { TypeTag } from "../components/PixelAvatar";
import { Backlinks, RelationChips, TypedRelations } from "../components/Relations";
import { Toc } from "../components/Toc";
import { Window } from "../components/Window";
import { boot } from "../lib/boot";
import { getNote, type NoteDoc } from "../lib/data";
import { LANG_NAMES, strings } from "../lib/i18n";
import { href } from "../lib/router";
import { typeStyle } from "../lib/styles";

type Tab = "body" | "relations" | "info";

export function NotePage({ url, lang, hash, onLoaded }: { url: string; lang: string; hash: string; onLoaded: (d: NoteDoc | null) => void }) {
  const t = strings(lang);
  const [doc, setDoc] = useState<NoteDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("body");

  useEffect(() => {
    let live = true;
    setError(null);
    getNote(url)
      .then((d) => {
        if (!live) return;
        setDoc(d);
        setTab("body");
        onLoaded(d);
        document.title = `${d.page.title} · ${boot.title}`;
      })
      .catch((e) => {
        if (!live) return;
        setError(String(e));
        onLoaded(null);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (error) return <p className="muted pad">{t.notFound}</p>;
  if (!doc) return <div className="loading" aria-busy="true" />;
  const p = doc.page;
  const editUrl = boot.repo ? `${boot.repo}/edit/main/${boot.editPath ?? ""}${p.path}` : null;
  const sourceUrl = boot.repo ? `${boot.repo}/blob/main/${boot.editPath ?? ""}${p.path}` : null;
  const relCount = p.relations.reduce((n, r) => n + r.items.length, 0) + p.backlinks.length;

  return (
    <Window
      as="article"
      className="page-window"
      iconColor={typeStyle(p.type).color}
      title={p.title}
      tabs={[
        { id: "body", label: t.noteTab },
        { id: "relations", label: t.relations, count: relCount },
        { id: "info", label: t.infoTab },
      ]}
      active={tab}
      onTab={(id) => setTab(id as Tab)}
      tools={
        <>
          <a className="btn btn--small hide-narrow" href={href.graph(lang, p.id)}>
            ◎ {t.graph}
          </a>
          {editUrl ? (
            <a className="btn btn--small hide-narrow" href={editUrl} target="_blank" rel="noreferrer">
              ✎ {t.edit}
            </a>
          ) : null}
        </>
      }
    >
      <div className="page-meta">
        <span className="page-meta__id mono" title={p.path}>
          {p.id}
        </span>
        <TypeTag type={p.type} />
        {p.status ? <span className="tag tag--mono">{p.status}</span> : null}
        {p.tags.map((tg) => (
          <a key={tg} className="tag tag--mono" href={href.tags(lang, tg)}>
            #{tg}
          </a>
        ))}
        <RelationChips page={p} />
        {boot.locales.length > 1 ? (
          <span className="chips" style={{ marginLeft: "auto" }}>
            {p.translations.map((tr) => (
              <a key={tr.lang} className={`tag tag--mono${tr.lang === lang ? " is-current" : ""}${tr.exists ? "" : " is-missing"}`} href={tr.url} title={tr.title ?? ""}>
                {LANG_NAMES[tr.lang] ?? tr.lang}
              </a>
            ))}
          </span>
        ) : null}
      </div>
      {tab === "body" ? (
        <div className="page-body" role="tabpanel">
          {p.fallback ? (
            <div className="callout" data-callout="info">
              <div className="callout-title">
                <span className="callout-icon" aria-hidden="true" />
                <span className="callout-label">{t.fallback}</span>
              </div>
            </div>
          ) : null}
          <Article html={doc.html} lang={lang} hash={hash} />
          {p.updated ? (
            <p className="page-foot mono muted">
              {t.updated} {p.updated}
              {sourceUrl ? (
                <>
                  {" · "}
                  <a href={sourceUrl} target="_blank" rel="noreferrer">
                    {t.source}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : tab === "relations" ? (
        <div className="page-body relations-tab" role="tabpanel">
          <TypedRelations page={p} empty="—" />
          <h3>{t.backlinks}</h3>
          <Backlinks items={p.backlinks} empty="—" />
        </div>
      ) : (
        <div className="page-body" role="tabpanel">
          <dl className="info-grid">
            <dt>id</dt>
            <dd className="mono">{p.id}</dd>
            <dt>path</dt>
            <dd className="mono">{p.path}</dd>
            <dt>type</dt>
            <dd>{p.type}</dd>
            {p.aliases.length ? (
              <>
                <dt>aliases</dt>
                <dd>{p.aliases.join(", ")}</dd>
              </>
            ) : null}
            {(["created", "updated", "reviewed"] as const).map((k) =>
              p[k] ? (
                <span key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd className="mono">{p[k]}</dd>
                </span>
              ) : null,
            )}
            <dt>words</dt>
            <dd className="mono">{p.words}</dd>
            <dt>rank</dt>
            <dd className="mono">{p.rank.toFixed(4)}</dd>
            <dt>{t.cluster}</dt>
            <dd className="mono">{p.cluster}</dd>
          </dl>
        </div>
      )}
    </Window>
  );
}

export function NoteRail({ doc, lang }: { doc: NoteDoc | null; lang: string }) {
  const t = strings(lang);
  if (!doc) return null;
  const p = doc.page;
  return (
    <>
      <Window icon="◎" iconColor="var(--sky)" title={t.localGraph} subtitle={`${Math.max(0, p.local.nodes.length - 1)} ${t.neighbours}`}>
        <LocalGraph page={p} />
        <div className="panel__foot">
          <a href={href.graph(lang, p.id)}>{t.openGraph} →</a>
        </div>
      </Window>
      {p.outline.length ? (
        <Window icon="≡" iconColor="var(--mint)" title={t.outline}>
          <Toc outline={p.outline} empty="—" />
        </Window>
      ) : null}
      {p.relations.length ? (
        <Window icon="⇄" iconColor="var(--sun)" title={t.relations}>
          <TypedRelations page={p} empty="—" />
        </Window>
      ) : null}
      <Window icon="↩" iconColor="var(--lilac)" title={t.backlinks} subtitle={String(p.backlinks.length)}>
        <Backlinks items={p.backlinks} empty="—" />
      </Window>
    </>
  );
}
