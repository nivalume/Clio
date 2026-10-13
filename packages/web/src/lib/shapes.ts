import type { Shape } from "./styles";

/** SVG path for a node shape centred on 0,0 with roughly the visual size of a circle of radius r. */
export function shapePath(shape: Shape, r: number): string {
  switch (shape) {
    case "square": {
      const s = r * 0.9;
      return `M${-s},${-s}H${s}V${s}H${-s}Z`;
    }
    case "diamond": {
      const s = r * 1.25;
      return `M0,${-s}L${s},0L0,${s}L${-s},0Z`;
    }
    case "triangle": {
      const s = r * 1.3;
      return `M0,${-s}L${s * 0.95},${s * 0.7}L${-s * 0.95},${s * 0.7}Z`;
    }
    case "star": {
      const outer = r * 1.35;
      const inner = outer * 0.48;
      let d = "";
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? inner : outer;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        d += `${i ? "L" : "M"}${(Math.cos(a) * rad).toFixed(2)},${(Math.sin(a) * rad).toFixed(2)}`;
      }
      return `${d}Z`;
    }
    case "cross": {
      const a = r * 1.05;
      const b = r * 0.38;
      return `M${-b},${-a}H${b}V${-b}H${a}V${b}H${b}V${a}H${-b}V${b}H${-a}V${-b}H${-b}Z`;
    }
    case "wye": {
      const a = r * 1.1;
      const b = r * 0.36;
      let d = "";
      for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        const cx = Math.cos(ang);
        const cy = Math.sin(ang);
        const px = -cy * b;
        const py = cx * b;
        d += `M${px},${py}L${cx * a + px},${cy * a + py}L${cx * a - px},${cy * a - py}L${-px},${-py}Z`;
      }
      return d;
    }
    default:
      return `M${r},0A${r},${r} 0 1,1 ${-r},0A${r},${r} 0 1,1 ${r},0Z`;
  }
}

/** Draw a node shape on a 2D canvas (same geometry as shapePath). */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number): void {
  if (shape === "circle") {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
    return;
  }
  const p = new Path2D(shapePath(shape, r));
  ctx.save();
  ctx.translate(x, y);
  ctx.fill(p);
  ctx.stroke(p);
  ctx.restore();
}
