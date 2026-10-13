import { useEffect, useMemo, useState } from "react";
import { PixelAvatar } from "../components/PixelAvatar";
import { Window } from "../components/Window";
import { getManifest } from "../lib/data";
import { strings } from "../lib/i18n";
import { href } from "../lib/router";
import type { Manifest } from "../lib/types";

interface TagNode {
  name: string;
  full: string;
  count: number;
  children: TagNode[];
}

function tree(m: Manifest): TagNode[] {
  const counts = new Map<string, number>();
  m.tagIds.forEach((ids) => {
    const seen = new Set<string>();
    for (const i of ids) {
      const parts = m.tags[i].split("/");
      for (let k = 1; k <= parts.length; k++) seen.add(parts.slice(0, k).join("/"));
    }
    seen.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
  });
  const root: TagNode[] = [];
  const index = new Map<string, TagNode>();
  for (const full of [...counts.keys()].sort()) {
    const parts = full.split("/");
    const node: TagNode = { name: parts[parts.length - 1], full, count: counts.get(full)!, children: [] };
    index.set(full, node);
    const parent = index.get(parts.slice(0, -1).join("/"));
    (parent ? parent.children : root).push(node);
  }
  const sort = (xs: TagNode[]) => {
    xs.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    xs.forEach((x) => sort(x.children));
  };
  sort(root);
  return root;
}

function TagTree({ nodes, lang, current }: { nodes: TagNode[]; lang: string; current: string | null }) {
  return (
    <ul className="tag-tree">
      {nodes.map((n) => (
        <li key={n.full}>
          <a href={href.tags(lang, n.full)} aria-current={current === n.full ? "page" : undefined}>
            #{n.name} <span className="mono muted">{n.count}</span>
          </a>
          {n.children.length ? <TagTree nodes={n.children} lang={lang} current={current} /> : null}
        </li>
      ))}
    </ul>
  );
}

export function TagsPage({ lang, tag }: { lang: string; tag: string | null }) {
  const t = strings(lang);
  const [m, setM] = useState<Manifest | null>(null);
  useEffect(() => {
    getManifest(lang).then(setM);
    document.title = tag ? `#${tag}` : t.tags;
  }, [lang, tag, t.tags]);
  const nodes = useMemo(() => (m ? tree(m) : []), [m]);
  const notes = useMemo(() => {
    if (!m || !tag) return [];
    const idx = new Set(m.tags.map((x, i) => (x === tag || x.startsWith(`${tag}/`) ? i : -1)).filter((i) => i >= 0));
    return m.id.map((_, i) => i).filter((i) => m.tagIds[i].some((x) => idx.has(x))).sort((a, b) => m.rank[b] - m.rank[a]);
  }, [m, tag]);
  if (!m) return <div className="loading" aria-busy="true" />;
  return (
    <div className="split-page">
      <Window icon="#" iconColor="var(--orange)" title={t.tags} subtitle={String(m.tags.length)}>
        <div className="pad">{nodes.length ? <TagTree nodes={nodes} lang={lang} current={tag} /> : <p className="muted">—</p>}</div>
      </Window>
      {tag ? (
        <Window icon="#" iconColor="var(--yellow)" title={`#${tag}`} subtitle={`${notes.length} ${t.notes}`}>
          <div className="chat">
            {notes.map((i) => (
              <a key={m.id[i]} className="msg" href={m.url[i]}>
                <PixelAvatar type={m.types[m.type[i]]} />
                <div style={{ minWidth: 0 }}>
                  <div className="msg__head">
                    <span className="msg__name">{m.title[i]}</span>
                    <span className="msg__time">{m.types[m.type[i]]}</span>
                  </div>
                  <div className="msg__text">{m.summary[i]}</div>
                </div>
              </a>
            ))}
          </div>
        </Window>
      ) : null}
    </div>
  );
}
