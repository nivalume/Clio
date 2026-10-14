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
        primaryColor: "#f2f0ea",
        primaryTextColor: "#15151c",
        primaryBorderColor: "#15151c",
        secondaryColor: "#e6ebff",
        tertiaryColor: "#e6e3da",
        lineColor: "#15151c",
        textColor: "#15151c",
        noteBkgColor: "#fff0a8",
        noteBorderColor: "#15151c",
        actorBkg: "#f2f0ea",
        actorBorder: "#15151c",
        clusterBkg: "#e9e6dd",
        clusterBorder: "#15151c",
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
      fig.innerHTML = `<div class="diagram__bar"><span>mermaid</span><span class="diagram__kind">${kind.replace(/[<>&"]/g, "")}</span></div><div class="diagram__canvas">${svg}</div>`;
      pre.replaceWith(fig);
    } catch (e) {
      document.getElementById(`d${id}`)?.remove();
      pre.classList.add("mermaid-error");
      pre.title = e instanceof Error ? e.message : String(e);
    }
  }
}
