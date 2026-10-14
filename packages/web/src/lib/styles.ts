import { boot } from "./boot";

/**
 * How each note type looks: colour, graph shape and 8×8 pixel icon. Known
 * types have fixed choices; custom types take the colour/shape pairs in the
 * order clio.toml declares them, so a type looks the same on every page.
 */
export type Shape = "star" | "circle" | "square" | "triangle" | "diamond" | "cross" | "wye";

export interface TypeStyle {
  color: string;
  shape: Shape;
  pixels: string[];
}

const PIX = {
  topic: ["...##...", "..####..", "########", ".######.", "..####..", ".##..##.", "##....##", "........"],
  concept: ["..####..", ".#....#.", "#..##..#", "#.#..#.#", ".#....#.", "..#..#..", "..####..", "...##..."],
  entity: ["..####..", ".######.", ".#.##.#.", ".######.", "..####..", ".######.", "########", "########"],
  source: [".######.", ".#....##", ".#.##.##", ".#....##", ".#.##.##", ".#....##", ".######.", ".#....#."],
  question: ["..####..", ".##..##.", ".....##.", "....##..", "...##...", "...##...", "........", "...##..."],
  journal: ["########", "#......#", "#.####.#", "#......#", "#.####.#", "#......#", "#.##...#", "########"],
  note: ["######..", "#....##.", "#.##..##", "#......#", "#.####.#", "#......#", "#.###..#", "########"],
  guide: ["...##...", ".######.", ".#######", "...##...", "#######.", ".######.", "...##...", "..####.."],
  reference: ["########", "#..##..#", "########", "#......#", "#.####.#", "#......#", "#......#", "########"],
  wanted: ["..####..", ".#....#.", "#......#", "#......#", "#......#", "#......#", ".#....#.", "..####.."],
};

const KNOWN: Record<string, Omit<TypeStyle, "pixels">> = {
  topic: { color: "var(--periwinkle)", shape: "star" },
  guide: { color: "var(--periwinkle)", shape: "star" },
  concept: { color: "var(--sky)", shape: "circle" },
  entity: { color: "var(--lilac)", shape: "square" },
  source: { color: "var(--sun)", shape: "triangle" },
  reference: { color: "var(--mint)", shape: "square" },
  question: { color: "var(--tomato)", shape: "diamond" },
  journal: { color: "var(--mint)", shape: "cross" },
  note: { color: "var(--pebble)", shape: "circle" },
  wanted: { color: "transparent", shape: "circle" },
};

const EXTRA: Omit<TypeStyle, "pixels">[] = [
  { color: "var(--tomato)", shape: "wye" },
  { color: "var(--lilac)", shape: "diamond" },
  { color: "var(--sky)", shape: "triangle" },
  { color: "var(--mint)", shape: "square" },
  { color: "var(--sun)", shape: "star" },
];

const custom = (boot.types ?? []).filter((t) => !(t in KNOWN));

/** Position of a custom type in clio.toml; a type no config declares gets a hash of its name. */
function extraIndex(type: string): number {
  const i = custom.indexOf(type);
  if (i >= 0) return i;
  let h = 0;
  for (const ch of type) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return custom.length + h;
}

export function typeStyle(type: string): TypeStyle {
  const known = KNOWN[type];
  const pixels = (PIX as Record<string, string[]>)[type] ?? PIX.note;
  if (known) return { ...known, pixels };
  return { ...EXTRA[extraIndex(type) % EXTRA.length], pixels };
}
