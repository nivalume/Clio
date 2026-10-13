import { boot, dataFor } from "./boot";
import type { GraphData, LintData, Manifest, PageData, SiteData } from "./types";

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load();
    cache.set(key, p);
    p.catch(() => cache.delete(key));
  }
  return p;
}

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return (await r.json()) as T;
}

export const getSite = (lang: string) => cached(`site:${lang}`, () => json<SiteData>(`${dataFor(lang)}site.json`));
export const getManifest = (lang: string) => cached(`manifest:${lang}`, () => json<Manifest>(`${dataFor(lang)}manifest.json`));
export const getGraph = (lang: string) => cached(`graph:${lang}`, () => json<GraphData>(`${dataFor(lang)}graph.json`));
export const getLint = (lang: string) => cached(`lint:${lang}`, () => json<LintData>(`${dataFor(lang)}lint.json`));

export interface NoteDoc {
  page: PageData;
  html: string;
}

/** The note page as built: boot JSON for the data, #clio-article for the HTML. */
export function getNote(url: string): Promise<NoteDoc> {
  const clean = url.split("#")[0].split("?")[0];
  return cached(`note:${clean}`, async () => {
    const r = await fetch(clean);
    if (!r.ok) throw new Error(`${clean}: ${r.status}`);
    const doc = new DOMParser().parseFromString(await r.text(), "text/html");
    const b = JSON.parse(doc.getElementById("clio-boot")?.textContent ?? "{}");
    if (!b.page) throw new Error(`${clean}: not a note page`);
    return { page: b.page as PageData, html: doc.getElementById("clio-article")?.innerHTML ?? "" };
  });
}

/** Seed the cache with the page the browser loaded first. */
export function seedFromDocument(): void {
  if (boot.route === "note" && boot.page) {
    const html = document.getElementById("clio-article")?.innerHTML ?? "";
    cache.set(`note:${window.location.pathname}`, Promise.resolve({ page: boot.page, html }));
  }
}
