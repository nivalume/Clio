import type { Boot } from "./types";

function read(): Boot {
  const el = document.getElementById("clio-boot");
  if (el?.textContent) return JSON.parse(el.textContent) as Boot;
  // Dev fallback: a bare page without boot data.
  return {
    base: "/",
    lang: "zh",
    locales: ["zh"],
    prefix: "/",
    title: "Clio",
    description: "",
    route: "home",
    app: "/_app/",
    data: "/_clio/zh/",
    pagefind: "/pagefind/",
    generated: "",
  };
}

/** Site-wide settings from the page that loaded the app; `lang`/`prefix` change when the reader switches language. */
export const boot: Boot = read();

export function prefixFor(lang: string): string {
  return boot.locales.length > 1 ? `${boot.base}${lang}/` : boot.base;
}

export function dataFor(lang: string): string {
  return `${boot.base}_clio/${lang}/`;
}
