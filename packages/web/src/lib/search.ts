import { boot } from "./boot";
import { getManifest } from "./data";
import { href } from "./router";

export interface Hit {
  id: string;
  title: string;
  type: string;
  url: string;
  excerpt: string;
  /** Where the hit came from: a title match or Pagefind's full-text index. */
  via: "title" | "text";
}

type Pagefind = {
  options(o: Record<string, unknown>): Promise<void>;
  init(): Promise<void>;
  debouncedSearch(q: string, o?: unknown, ms?: number): Promise<{ results: { data(): Promise<{ url: string; excerpt: string; meta: Record<string, string> }> }[] } | null>;
};

let pagefind: Promise<Pagefind | null> | null = null;

function loadPagefind(): Promise<Pagefind | null> {
  pagefind ??= import(/* @vite-ignore */ `${boot.pagefind}pagefind.js`)
    .then(async (m: Pagefind) => {
      await m.options({ excerptLength: 24 });
      await m.init();
      return m;
    })
    .catch(() => null);
  return pagefind;
}

function norm(s: string) {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** Title, id and alias matches from the manifest; instant. */
export async function titleSearch(lang: string, q: string, limit = 8): Promise<Hit[]> {
  const m = await getManifest(lang);
  const needle = norm(q);
  if (!needle) return [];
  const scored: [number, number][] = [];
  for (let i = 0; i < m.id.length; i++) {
    const t = norm(m.title[i]);
    const id = norm(m.id[i]);
    let s = 0;
    if (t === needle || id === needle) s = 100;
    else if (t.startsWith(needle) || id.startsWith(needle)) s = 60;
    else if (t.includes(needle) || id.includes(needle)) s = 30;
    if (s) scored.push([s + m.rank[i] * 10, i]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, limit).map(([, i]) => ({
    id: m.id[i],
    title: m.title[i],
    type: m.types[m.type[i]],
    url: href.note(lang, m.id[i]),
    excerpt: m.summary[i],
    via: "title" as const,
  }));
}

/** Full-text hits from Pagefind (body text, Chinese segmentation). */
export async function textSearch(q: string, limit = 12): Promise<Hit[]> {
  const pf = await loadPagefind();
  if (!pf || !q.trim()) return [];
  const res = await pf.debouncedSearch(q, {}, 120);
  if (!res) return [];
  const data = await Promise.all(res.results.slice(0, limit).map((r) => r.data()));
  return data.map((d) => {
    const url = d.url.replace(/\.html$/, "");
    const id = decodeURIComponent(url.split("/n/")[1] ?? url);
    return { id, title: d.meta.title ?? id, type: d.meta.type ?? "note", url, excerpt: d.excerpt, via: "text" as const };
  });
}
