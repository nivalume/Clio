import { useEffect, useMemo, useState } from "react";
import { PixelAvatar } from "../components/PixelAvatar";
import { Window } from "../components/Window";
import { getLint } from "../lib/data";
import { strings } from "../lib/i18n";
import type { LintData } from "../lib/types";

/** Same normalisation as the engine's `text::key`. */
function noteKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+$/, "");
}

export function HealthPage({ lang }: { lang: string }) {
  const t = strings(lang);
  const [data, setData] = useState<LintData | null>(null);
  const [level, setLevel] = useState<"error" | "warning" | "info">("warning");
  useEffect(() => {
    getLint(lang).then(setData);
    document.title = t.health;
  }, [lang, t.health]);
  const groups = useMemo(() => {
    const by = new Map<string, LintData["diags"]>();
    const rank = { error: 0, warning: 1, info: 2 };
    for (const d of data?.diags ?? []) {
      if (rank[d.level] > rank[level]) continue;
      const k = `${d.level}:${d.code}`;
      by.set(k, [...(by.get(k) ?? []), d]);
    }
    return [...by.entries()].sort((a, b) => rank[a[1][0].level] - rank[b[1][0].level] || b[1].length - a[1].length);
  }, [data, level]);
  // Links to missing notes point at `wanted#<target>`; the list is keyed by the normalised id.
  const target = useMemo(() => {
    const h = decodeURIComponent(window.location.hash.slice(1));
    return h ? noteKey(h) : null;
  }, []);
  useEffect(() => {
    if (data && target) document.getElementById(`w-${target}`)?.scrollIntoView({ block: "center" });
  }, [data, target]);
  if (!data) return <div className="loading" aria-busy="true" />;
  const count = (l: string) => data.diags.filter((d) => d.level === l).length;
  return (
    <div className="split-page">
      <Window icon="!" iconColor="var(--error)" title={t.lint} subtitle={`${count("error")} ${t.errors} · ${count("warning")} ${t.warnings} · ${count("info")} ${t.notices}`}
        tools={
          <span className="segmented" role="group">
            {(["error", "warning", "info"] as const).map((l) => (
              <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
                {l === "error" ? t.errors : l === "warning" ? t.warnings : t.notices}
              </button>
            ))}
          </span>
        }
      >
        {groups.length === 0 ? <p className="muted pad">{t.noIssues}</p> : null}
        {groups.map(([key, diags]) => (
          <details key={key} className="lint-group" open={diags[0].level !== "info"}>
            <summary>
              <span className={`lint-level lint-level--${diags[0].level}`}>{diags[0].level}</span>
              <span className="mono">{diags[0].code}</span>
              <span className="mono muted">{diags.length}</span>
            </summary>
            <ul>
              {diags.slice(0, 200).map((d, i) => (
                <li key={i}>
                  <span className="mono">
                    {d.path}:{d.line}
                  </span>{" "}
                  {d.message}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </Window>
      <Window icon="?" iconColor="var(--pebble)" title={t.wantedNotes} subtitle={String(data.wanted.length)}>
        {data.wanted.length === 0 ? <p className="muted pad">{t.noIssues}</p> : null}
        <div className="chat">
          {data.wanted.map((w) => (
            <div key={w.id} className="msg msg--wanted" id={`w-${w.id}`} data-target={target === w.id || undefined}>
              <PixelAvatar type="wanted" />
              <div style={{ minWidth: 0 }}>
                <div className="msg__head">
                  <span className="msg__name">{w.title}</span>
                  <span className="msg__time">×{w.count}</span>
                </div>
                <div className="msg__text">
                  {t.linkedFrom}:{" "}
                  {w.from.map((f, i) => (
                    <span key={f.id}>
                      {i ? ", " : ""}
                      <a href={f.url}>{f.title}</a>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Window>
    </div>
  );
}
