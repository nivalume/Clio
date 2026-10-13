import { useEffect, useRef, useState, type ReactNode } from "react";

/** Renders only the rows near the viewport; rows have a fixed height. */
export function VirtualList({ count, rowHeight, render, overscan = 8 }: { count: number; rowHeight: number; render: (i: number) => ReactNode; overscan?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<[number, number]>([0, 40]);
  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const first = Math.max(0, Math.floor(-top / rowHeight) - overscan);
      const last = Math.min(count, Math.ceil((window.innerHeight - top) / rowHeight) + overscan);
      setRange((r) => (r[0] === first && r[1] === last ? r : [first, last]));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [count, rowHeight, overscan]);
  const rows: ReactNode[] = [];
  for (let i = range[0]; i < Math.min(range[1], count); i++) {
    rows.push(
      <div key={i} className="vrow" style={{ position: "absolute", top: i * rowHeight, left: 0, right: 0, height: rowHeight }}>
        {render(i)}
      </div>,
    );
  }
  return (
    <div ref={ref} style={{ position: "relative", height: count * rowHeight }} role="list">
      {rows}
    </div>
  );
}
