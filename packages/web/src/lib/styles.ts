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
  topic: { color: "var(--yellow)", shape: "star" },
  guide: { color: "var(--yellow)", shape: "star" },
  concept: { color: "var(--cyan)", shape: "circle" },
  entity: { color: "var(--pink)", shape: "square" },
  source: { color: "var(--lavender)", shape: "triangle" },
  reference: { color: "var(--lavender)", shape: "square" },
  question: { color: "var(--lime)", shape: "diamond" },
  journal: { color: "var(--orange)", shape: "cross" },
  note: { color: "var(--stone-2)", shape: "circle" },
  wanted: { color: "transparent", shape: "circle" },
};

const EXTRA: Omit<TypeStyle, "pixels">[] = [
  { color: "var(--orange)", shape: "wye" },
  { color: "var(--pink)", shape: "diamond" },
  { color: "var(--cyan)", shape: "triangle" },
  { color: "var(--lime)", shape: "square" },
  { color: "var(--lavender)", shape: "star" },
];

const assigned = new Map<string, number>();

export function typeStyle(type: string): TypeStyle {
  const known = KNOWN[type];
  const pixels = (PIX as Record<string, string[]>)[type] ?? PIX.note;
  if (known) return { ...known, pixels };
  if (!assigned.has(type)) assigned.set(type, assigned.size % EXTRA.length);
  return { ...EXTRA[assigned.get(type)!], pixels };
}
