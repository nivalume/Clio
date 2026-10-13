import { useEffect, useState } from "react";
import { boot } from "./boot";

/**
 * History-API routes under the site base, with an optional language segment:
 *   {base}[lang/]               home
 *   {base}[lang/]n/<id>         note
 *   {base}[lang/]graph          graph   (?focus=<id>)
 *   {base}[lang/]explore        explore (?type=&tag=&sort=)
 *   {base}[lang/]tags[/<tag>]   tags
 *   {base}[lang/]health         lint report and wanted notes
 */
export type Route =
  | { name: "home"; lang: string }
  | { name: "note"; lang: string; id: string; url: string; hash: string }
  | { name: "graph"; lang: string; focus: string | null }
  | { name: "explore"; lang: string; params: URLSearchParams }
  | { name: "tags"; lang: string; tag: string | null }
  | { name: "health"; lang: string }
  | { name: "404"; lang: string; path: string };

export function parse(loc: Location | URL = window.location): Route {
  let path = decodeURIComponent(loc.pathname);
  if (path.startsWith(boot.base)) path = path.slice(boot.base.length);
  path = path.replace(/\.html$/, "").replace(/\/index$/, "").replace(/\/$/, "");
  let parts = path ? path.split("/") : [];
  let lang = boot.locales[0];
  if (boot.locales.length > 1 && parts[0] && boot.locales.includes(parts[0])) {
    lang = parts[0];
    parts = parts.slice(1);
  }
  const params = new URLSearchParams(loc.search);
  const [head, ...rest] = parts;
  if (!head) return { name: "home", lang };
  if (head === "n" && rest.length) return { name: "note", lang, id: rest.join("/"), url: loc.pathname, hash: loc.hash.slice(1) };
  if (head === "graph") return { name: "graph", lang, focus: params.get("focus") };
  if (head === "explore") return { name: "explore", lang, params };
  if (head === "tags") return { name: "tags", lang, tag: rest.length ? rest.join("/") : null };
  if (head === "health" || head === "wanted") return { name: "health", lang };
  return { name: "404", lang, path: loc.pathname };
}

export function prefix(lang: string): string {
  return boot.locales.length > 1 ? `${boot.base}${lang}/` : boot.base;
}

export const href = {
  home: (lang: string) => prefix(lang),
  note: (lang: string, id: string, anchor?: string) => `${prefix(lang)}n/${encodeURIComponent(id)}${anchor ? `#${encodeURIComponent(anchor)}` : ""}`,
  graph: (lang: string, focus?: string | null) => `${prefix(lang)}graph${focus ? `?focus=${encodeURIComponent(focus)}` : ""}`,
  explore: (lang: string, q?: Record<string, string>) => `${prefix(lang)}explore${q && Object.keys(q).length ? `?${new URLSearchParams(q)}` : ""}`,
  tags: (lang: string, tag?: string) => `${prefix(lang)}tags${tag ? `/${tag.split("/").map(encodeURIComponent).join("/")}` : ""}`,
  health: (lang: string) => `${prefix(lang)}health`,
};

const listeners = new Set<() => void>();

export function navigate(to: string, replace = false): void {
  const url = new URL(to, window.location.href);
  if (url.origin !== window.location.origin) {
    window.location.href = to;
    return;
  }
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  listeners.forEach((f) => f());
  if (!url.hash) window.scrollTo({ top: 0 });
}

/** Should a click on this link be handled by the app? */
export function isAppLink(a: HTMLAnchorElement): boolean {
  if (a.target && a.target !== "_self") return false;
  if (a.hasAttribute("download")) return false;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (!url.pathname.startsWith(boot.base)) return false;
  if (/\.(md|txt|json|xml|png|jpe?g|gif|svg|webp|pdf)$/i.test(url.pathname)) return false;
  if (url.pathname.startsWith(`${boot.base}_`) || url.pathname.startsWith(`${boot.base}pagefind`)) return false;
  // Same page, only a hash: let the browser scroll.
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
  return parse(url).name !== "404";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse());
  useEffect(() => {
    const update = () => setRoute(parse());
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return route;
}

/** Intercept clicks on internal links anywhere in the document. */
export function installLinkHandler(): void {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || !isAppLink(a)) return;
    e.preventDefault();
    navigate(a.href);
  });
}
