import { useMemo } from "react";
import { typeStyle } from "../lib/styles";

/** An 8×8 pixel icon on the type's colour; `online` adds the green presence dot. */
export function PixelAvatar({ type, online = false, size = 34, title }: { type: string; online?: boolean; size?: number; title?: string }) {
  const style = typeStyle(type);
  const d = useMemo(() => {
    let path = "";
    style.pixels.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === "#") path += `M${x} ${y}h1v1h-1z`;
    });
    return path;
  }, [style]);
  return (
    <span
      className={`avatar${online ? " avatar--online" : ""}${type === "wanted" ? " avatar--wanted" : ""}`}
      style={{ width: size, height: size }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="-1 -1 10 10" shapeRendering="crispEdges">
        <rect x="-1" y="-1" width="10" height="10" fill={style.color} />
        <path d={d} fill="#141111" />
      </svg>
    </span>
  );
}

export function TypeTag({ type, label }: { type: string; label?: string }) {
  const s = typeStyle(type);
  return (
    <span className="tag" style={{ background: type === "wanted" ? "transparent" : s.color }} data-type={type}>
      {label ?? type}
    </span>
  );
}
