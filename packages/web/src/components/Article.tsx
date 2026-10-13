import { useEffect, useRef } from "react";
import { getManifest } from "../lib/data";
import { strings } from "../lib/i18n";
import { renderMermaid } from "../lib/mermaid";

/** Wire up interactive parts of rendered note HTML (works on any article element). */
function enhance(root: HTMLElement, lang: string): () => void {
  const t = strings(lang);
  const cleanups: (() => void)[] = [];

  // Tabs: show one panel at a time once the script runs (all panels show without JS).
  for (const box of root.querySelectorAll<HTMLElement>("[data-tabs]")) {
    if (box.dataset.ready) continue;
    box.dataset.ready = "1";
    const buttons = [...box.querySelectorAll<HTMLButtonElement>(":scope > .tabs-bar > .tab-button")];
    const panels = [...box.querySelectorAll<HTMLElement>(":scope > .directive-tab")];
    const select = (i: number) => {
      buttons.forEach((b, j) => b.setAttribute("aria-selected", String(i === j)));
      panels.forEach((p, j) => (p.hidden = i !== j));
    };
    buttons.forEach((b, i) => b.addEventListener("click", () => select(i)));
    select(0);
  }

  // Copy buttons on code blocks.
  for (const fig of root.querySelectorAll<HTMLElement>("figure.code:not([data-ready])")) {
    fig.dataset.ready = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-copy";
    btn.textContent = t.copy;
    btn.addEventListener("click", async () => {
      const code = fig.querySelector("pre")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code.replace(/\n$/, ""));
        btn.textContent = t.copied;
        setTimeout(() => (btn.textContent = t.copy), 1400);
      } catch {
        /* clipboard blocked */
      }
    });
    fig.prepend(btn);
  }

  void renderMermaid(root);

  // Hover previews for note links.
  let card: HTMLDivElement | null = null;
  let timer = 0;
  const hide = () => {
    clearTimeout(timer);
    card?.remove();
    card = null;
  };
  const over = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.("a.wl[data-id]") as HTMLAnchorElement | null;
    if (!a || !root.contains(a)) return;
    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const m = await getManifest(lang).catch(() => null);
      if (!m) return;
      const i = m.id.indexOf(a.dataset.id ?? "");
      if (i < 0) return;
      hide();
      card = document.createElement("div");
      card.className = "link-preview";
      const title = document.createElement("strong");
      title.textContent = m.title[i];
      const meta = document.createElement("span");
      meta.className = "link-preview__meta";
      meta.textContent = `${m.types[m.type[i]]}${m.updated[i] ? ` · ${m.updated[i]}` : ""}`;
      const body = document.createElement("p");
      body.textContent = m.summary[i];
      card.append(title, meta, body);
      document.body.append(card);
      const r = a.getBoundingClientRect();
      const left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 340);
      card.style.left = `${Math.max(8, left)}px`;
      card.style.top = `${window.scrollY + r.bottom + 8}px`;
    }, 350);
  };
  const out = (e: MouseEvent) => {
    const a = (e.target as Element).closest?.("a.wl[data-id]");
    if (a) hide();
  };
  root.addEventListener("mouseover", over);
  root.addEventListener("mouseout", out);
  cleanups.push(() => {
    root.removeEventListener("mouseover", over);
    root.removeEventListener("mouseout", out);
    hide();
  });
  return () => cleanups.forEach((f) => f());
}

export function Article({ html, lang, hash }: { html: string; lang: string; hash?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const undo = enhance(el, lang);
    if (hash) {
      const target = document.getElementById(decodeURIComponent(hash));
      target?.scrollIntoView({ block: "start" });
    }
    return undo;
  }, [html, lang, hash]);
  return <article ref={ref} id="clio-article" className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
