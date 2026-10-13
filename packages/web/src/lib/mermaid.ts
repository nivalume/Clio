type MermaidApi = typeof import("mermaid").default;
let loader: Promise<MermaidApi> | null = null;

/**
 * Mermaid is large, so it is loaded on first use. Diagrams always use the
 * light palette on a white card: many blocks set their own classDef fills,
 * which only read with dark text.
 */
function load(): Promise<MermaidApi> {
  loader ??= import("mermaid").then((m) => {
    const mermaid = m.default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: '"Space Grotesk", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
      themeVariables: {
        background: "#ffffff",
        primaryColor: "#fffaef",
        primaryTextColor: "#141111",
        primaryBorderColor: "#141111",
        secondaryColor: "#ffd440",
        tertiaryColor: "#f1ebdd",
        lineColor: "#141111",
        textColor: "#141111",
        noteBkgColor: "#ffe58f",
        noteBorderColor: "#141111",
        actorBkg: "#fffaef",
        actorBorder: "#141111",
        clusterBkg: "#fbf1da",
        clusterBorder: "#141111",
        edgeLabelBackground: "#ffffff",
        fontSize: "14px",
      },
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    return mermaid;
  });
  return loader;
}

let counter = 0;

/** Replace each `pre.mermaid` inside `root` with the rendered diagram. */
export async function renderMermaid(root: HTMLElement): Promise<void> {
  const blocks = [...root.querySelectorAll<HTMLPreElement>("pre.mermaid:not([data-done])")];
  if (!blocks.length) return;
  const mermaid = await load();
  for (const pre of blocks) {
    pre.dataset.done = "1";
    const code = pre.textContent ?? "";
    const id = `mmd-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      const fig = document.createElement("figure");
      fig.className = "diagram";
      const kind = code.trim().split(/\s+/)[0] ?? "mermaid";
      fig.innerHTML = `<div class="diagram__bar"><span>mermaid · ${kind.replace(/[<>&"]/g, "")}</span><span class="window__dots" aria-hidden="true"><i></i><i></i><i></i></span></div><div class="diagram__canvas">${svg}</div>`;
      pre.replaceWith(fig);
    } catch (e) {
      document.getElementById(`d${id}`)?.remove();
      pre.classList.add("mermaid-error");
      pre.title = e instanceof Error ? e.message : String(e);
    }
  }
}
