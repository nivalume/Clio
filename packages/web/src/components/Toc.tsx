import { useEffect, useState } from "react";

/** Section list for the current note; the section in view is marked. */
export function Toc({ outline, empty }: { outline: { depth: number; text: string; slug: string }[]; empty: string }) {
  const items = outline.filter((h) => h.depth <= 3);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    setActive(null);
    const els = items.map((h) => document.getElementById(h.slug)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size) setActive([...visible.entries()].sort((a, b) => a[1] - b[1])[0][0]);
        else {
          const above = els.filter((el) => el.getBoundingClientRect().top < 120);
          if (above.length) setActive(above[above.length - 1].id);
        }
      },
      { rootMargin: "-70px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outline]);
  if (!items.length) return <p className="muted pad">{empty}</p>;
  return (
    <ul className="toc">
      {items.map((h) => (
        <li key={h.slug} className={h.depth === 3 ? "d3" : undefined}>
          <a href={`#${encodeURIComponent(h.slug)}`} data-active={active === h.slug}>
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );
}
