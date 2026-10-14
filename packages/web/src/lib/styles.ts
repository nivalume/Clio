/**
 * How each note type looks: colour, graph shape and 8×8 pixel icon. Known
 * types have fixed choices; custom types take the next colour/shape pair.
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

const assigned = new Map<string, number>();

export function typeStyle(type: string): TypeStyle {
  const known = KNOWN[type];
  const pixels = (PIX as Record<string, string[]>)[type] ?? PIX.note;
  if (known) return { ...known, pixels };
  if (!assigned.has(type)) assigned.set(type, assigned.size % EXTRA.length);
  return { ...EXTRA[assigned.get(type)!], pixels };
}
