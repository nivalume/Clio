import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

export interface PanelTab {
  id: string;
  label: ReactNode;
  count?: number | null;
}

/**
 * A panel with a folder tab on top. One title tab by default; with `tabs`, a
 * row of folder tabs that switch the panel's content (arrow keys move between
 * them). `iconColor` paints the strip along the top of the active tab.
 */
export function Window({
  icon,
  iconColor,
  title,
  subtitle,
  tools,
  children,
  className = "",
  dotted = false,
  as: Tag = "section",
  labelledBy,
  tabs,
  active,
  onTab,
}: {
  icon?: ReactNode;
  iconColor?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  tools?: ReactNode;
  children: ReactNode;
  className?: string;
  dotted?: boolean;
  as?: "section" | "aside" | "nav" | "article" | "div";
  labelledBy?: string;
  tabs?: PanelTab[];
  active?: string;
  onTab?: (id: string) => void;
}) {
  const strip = { "--tab": iconColor ?? "var(--cobalt)" } as CSSProperties;
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (!tabs || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
    e.preventDefault();
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    onTab?.(next.id);
    const row = e.currentTarget.parentElement;
    requestAnimationFrame(() => row?.querySelector<HTMLButtonElement>(`[data-tab="${CSS.escape(next.id)}"]`)?.focus());
  };
  const head = tabs?.length ? (
    <div className="panel__tabs" role="tablist" aria-label={typeof title === "string" ? title : undefined}>
      {tabs.map((t, i) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            data-tab={t.id}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className="panel__tab"
            style={on ? strip : undefined}
            onClick={() => onTab?.(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
            {t.count != null ? <span className="panel__count">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  ) : (
    <div className="panel__tabs">
      <div className="panel__tab panel__tab--title" id={labelledBy} style={strip}>
        {icon ? (
          <span className="panel__glyph" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className="panel__title">{title}</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
    </div>
  );
  const panel = (
    <Tag className={`panel${dotted ? " panel--dotted" : ""} ${className}`} aria-labelledby={labelledBy}>
      <div className="panel__head">
        {head}
        {tools ? <div className="panel__tools">{tools}</div> : null}
      </div>
      <div className="panel__body">{children}</div>
    </Tag>
  );
  // The halftone shadow sits at z-index -1; the wrapper is its stacking context, so it stays above the page background.
  return dotted ? <div className="panel-shell">{panel}</div> : panel;
}
