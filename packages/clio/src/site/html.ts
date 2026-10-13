/**
 * HTML for the static pages. Every page is readable without JavaScript: a
 * header with the main views, the content, and plain lists of relations.
 * The app script then takes over `#clio-root`, reading `#clio-boot` and
 * `#clio-article` from the page it was loaded on.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

/** JSON that is safe inside <script>. */
export function jsonScript(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const UI = {
  zh: { home: "首页", explore: "浏览", graph: "图谱", tags: "标签", health: "健康", relations: "关系", backlinks: "链接到这里", hubs: "枢纽", recent: "最近更新", notes: "篇笔记", noscript: "这个视图需要 JavaScript；笔记页面不需要。", notFound: "找不到这个页面", tagged: "带有标签" },
  en: { home: "Home", explore: "Explore", graph: "Graph", tags: "Tags", health: "Health", relations: "Relations", backlinks: "Linked from", hubs: "Hubs", recent: "Recently updated", notes: "notes", noscript: "This view needs JavaScript; note pages do not.", notFound: "Page not found", tagged: "Tagged" },
};

export function ui(lang: string) {
  return lang.startsWith("zh") ? UI.zh : UI.en;
}

export interface Shell {
  lang: string;
  title: string;
  description: string;
  base: string;
  prefix: string;
  siteTitle: string;
  boot: Record<string, unknown>;
  body: string;
  /** Extra tags for <head>. */
  head?: string;
  fonts: boolean;
  theme: boolean;
}

const FONTS =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">';

/** Sets the stored theme before first paint. */
const THEME_INIT = `<script>try{var t=localStorage.getItem("clio-theme");if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>`;

export function page(s: Shell): string {
  const t = ui(s.lang);
  const nav = [
    [`${s.prefix}explore`, t.explore],
    [`${s.prefix}graph`, t.graph],
    [`${s.prefix}tags`, t.tags],
    [`${s.prefix}health`, t.health],
  ]
    .map(([href, label]) => `<a class="topbar__link" href="${escape(href)}">${escape(label)}</a>`)
    .join("");
  return `<!doctype html>
<html lang="${escape(s.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(s.title)}</title>
${s.description ? `<meta name="description" content="${escape(s.description)}">` : ""}
<meta name="generator" content="Clio">
${THEME_INIT}
${s.fonts ? FONTS : ""}
<link rel="stylesheet" href="${s.base}_app/app.css">
<link rel="stylesheet" href="${s.base}_app/katex/katex.min.css">
${s.theme ? `<link rel="stylesheet" href="${s.base}_app/theme/theme.css">` : ""}
<link rel="icon" href="${s.base}_app/favicon.svg" type="image/svg+xml">
${s.head ?? ""}
<script type="module" src="${s.base}_app/app.js"></script>
</head>
<body>
<div id="clio-root" data-static>
<header class="topbar"><a class="brand" href="${escape(s.prefix)}"><span class="brand__mark">${escape(s.siteTitle)}</span></a><nav class="topbar__nav" aria-label="main">${nav}</nav></header>
<div class="static-shell">
${s.body}
</div>
</div>
<script type="application/json" id="clio-boot">${jsonScript(s.boot)}</script>
</body>
</html>
`;
}

export interface Item {
  title: string;
  url: string;
  type?: string;
  summary?: string;
  context?: string;
}

export function list(items: Item[], quote = false): string {
  if (!items.length) return "";
  return `<ul class="static-list">${items
    .map((i) => {
      const extra = quote && i.context ? `: “${escape(i.context)}”` : i.summary ? ` — ${escape(i.summary)}` : "";
      return `<li><a href="${escape(i.url)}">${escape(i.title)}</a>${i.type ? ` <small>${escape(i.type)}</small>` : ""}${extra}</li>`;
    })
    .join("")}</ul>`;
}

/** Pick a language on the root page: stored choice, then the browser's languages. */
export function langRedirect(base: string, locales: string[]): string {
  return `<script>(function(){var L=${jsonScript(locales)},b=${jsonScript(base)},p=null;try{var s=localStorage.getItem("clio-lang");if(L.indexOf(s)>=0)p=s}catch(e){}if(!p){var n=navigator.languages||[navigator.language];for(var i=0;i<n.length&&!p;i++){var c=String(n[i]).toLowerCase().split("-")[0];if(L.indexOf(c)>=0)p=c}}if(p&&p!==L[0])location.replace(b+p+"/"+location.search+location.hash)})()</script>`;
}

export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="1" y="1" width="30" height="30" fill="#ffd440" stroke="#141111" stroke-width="2"/><path d="M9 8h14v4H13v8h10v4H9z" fill="#141111"/></svg>`;
