/**
 * Data shapes written by the site builder (see packages/clio/src/site).
 */
export interface Boot {
  base: string;
  lang: string;
  locales: string[];
  prefix: string;
  title: string;
  description: string;
  route: RouteName;
  tag?: string;
  page?: PageData;
  repo?: string;
  editPath?: string;
  /** Every type in clio.toml order (built-ins first). */
  types?: string[];
  app: string;
  data: string;
  pagefind: string;
  generated: string;
}

export type RouteName = "home" | "note" | "graph" | "explore" | "tags" | "tag" | "health" | "404";

export interface Related {
  id: string;
  title: string;
  type: string;
  summary?: string;
  url: string;
  context?: string;
  wanted?: boolean;
}

export interface PageData {
  id: string;
  key: string;
  lang: string;
  noteLang: string;
  fallback: boolean;
  path: string;
  title: string;
  type: string;
  summary: string;
  tags: string[];
  aliases: string[];
  status: string | null;
  created: string | null;
  updated: string | null;
  reviewed: string | null;
  words: number;
  url: string;
  outline: { depth: number; text: string; slug: string }[];
  relations: { label: string; direction: "in" | "out"; items: Related[] }[];
  backlinks: Related[];
  local: { nodes: Related[]; edges: [number, number, string][] };
  translations: { lang: string; url: string; exists: boolean; title: string | null }[];
  rank: number;
  cluster: number;
}

export interface SiteData {
  title: string;
  base: string;
  lang: string;
  locales: string[];
  types: { name: string; label: string; count: number }[];
  relations: { name: string; inverse?: string | null; symmetric?: boolean; label?: Record<string, string> }[];
  stats: { notes: number; files: number; edges: number; wanted: number; words: number; tags: number };
  hubs: SiteItem[];
  recent: SiteItem[];
  clusters: { id: number; label: string; size: number; members: SiteItem[] }[];
  tags: [string, number][];
  lint: { errors: number; warnings: number; infos: number };
  index?: { html: string; title: string } | null;
}

export interface SiteItem {
  id: string;
  title: string;
  type: string;
  summary: string;
  url: string;
  updated: string | null;
  rank: number;
}

/** Column-oriented note list (summaries shortened; note URLs come from `href.note`). */
export interface Manifest {
  lang: string;
  types: string[];
  tags: string[];
  id: string[];
  title: string[];
  type: number[];
  tagIds: number[][];
  status: (string | null)[];
  updated: (string | null)[];
  summary: string[];
  rank: number[];
  in: number[];
  out: number[];
}

export interface GraphData {
  nodes: { id: string; title: string; type: string; rank: number; cluster: number; url?: string; wanted?: boolean; x?: number; y?: number }[];
  edges: [number, number, number][];
  kinds: string[];
  clusters: { id: number; label: string; size: number }[];
}

export interface LintData {
  diags: { path: string; level: "error" | "warning" | "info"; line: number; code: string; message: string }[];
  wanted: { id: string; title: string; count: number; from: { id: string; title: string; url: string }[] }[];
}
