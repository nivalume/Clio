/** Read-only commands: check, show, backlinks, search, context, resolve, stats. */
import { join } from "node:path";
import { num, str, type Args } from "../args";
import { c, fail, pad, print, printJson } from "../ui";
import { Vault, type Diag } from "../vault";

const LEVEL_ORDER = { error: 0, warning: 1, info: 2 } as const;

export async function check(vault: Vault, args: Args): Promise<number> {
  const summary = vault.build();
  const minLevel = args.flags.all ? "info" : (str(args.flags, "level", "warning") as keyof typeof LEVEL_ORDER);
  const diags = vault.lint().filter((d) => LEVEL_ORDER[d.level] <= (LEVEL_ORDER[minLevel] ?? 1));
  if (args.flags.json) {
    printJson({ summary, diags });
  } else {
    let last = "";
    for (const d of diags) {
      if (d.path !== last) {
        print(c.bold(d.path));
        last = d.path;
      }
      const color = d.level === "error" ? c.red : d.level === "warning" ? c.yellow : c.dim;
      print(`  ${pad(String(d.line), 5)}${color(pad(d.level, 8))}${c.dim(pad(d.code, 22))}${d.message}`);
    }
    if (diags.length) print("");
    print(
      `${summary.notes} notes · ${summary.files} files · ${summary.edges} links · ${summary.wanted} wanted · ` +
        `${summary.errors ? c.red(`${summary.errors} errors`) : "0 errors"} · ${summary.warnings} warnings · ${summary.infos} notices`,
    );
  }
  if (summary.errors > 0) return 1;
  if (args.flags.strict && summary.warnings > 0) return 1;
  return 0;
}

function requireId(args: Args, what: string): string {
  const id = args.positionals.join(" ").trim();
  if (!id) fail(`usage: clio ${what} <id, alias or title>`);
  return id;
}

export async function show(vault: Vault, args: Args): Promise<number> {
  const id = requireId(args, "show");
  const p = vault.page(id, str(args.flags, "lang", vault.defaultLang));
  if (p.error) fail(`no note matches "${id}"`);
  if (args.flags.json) {
    const { html: _html, plugins: _plugins, ...rest } = p;
    printJson(rest);
    return 0;
  }
  print(`${c.bold(p.title)}  ${c.dim(`${p.id} · ${p.type} · ${p.path}`)}`);
  if (p.summary) print(p.summary);
  if (p.tags.length) print(c.dim(`tags: ${p.tags.map((t) => `#${t}`).join(" ")}`));
  if (p.outline.length) print("", c.bold("Sections"), ...p.outline.map((h) => `${"  ".repeat(h.depth - 2)}- ${h.text}`));
  for (const r of p.relations) print("", c.bold(`${r.direction === "out" ? "→" : "←"} ${r.label}`), ...r.items.map((i) => `  ${i.title} ${c.dim(i.id)}`));
  if (p.backlinks.length) print("", c.bold(`← linked from (${p.backlinks.length})`), ...p.backlinks.map((b) => `  ${b.title} ${c.dim(b.id)}`));
  return 0;
}

export async function backlinks(vault: Vault, args: Args): Promise<number> {
  const id = requireId(args, "backlinks");
  const p = vault.page(id, str(args.flags, "lang", vault.defaultLang));
  if (p.error) fail(`no note matches "${id}"`);
  if (args.flags.json) {
    printJson({ id: p.id, relations: p.relations.filter((r) => r.direction === "in"), backlinks: p.backlinks });
    return 0;
  }
  const incoming = p.relations.filter((r) => r.direction === "in");
  for (const r of incoming) print(c.bold(r.label), ...r.items.map((i) => `  ${i.title} ${c.dim(i.id)}`));
  print(c.bold(`linked from (${p.backlinks.length})`));
  for (const b of p.backlinks) print(`  ${b.title} ${c.dim(b.id)}`, b.context ? `    ${c.dim(b.context)}` : "");
  return 0;
}

export async function search(vault: Vault, args: Args): Promise<number> {
  const q = args.positionals.join(" ").trim();
  if (!q) fail("usage: clio search <query>");
  vault.build();
  const hits = vault.search(q, num(args.flags, "limit", 10), str(args.flags, "lang", vault.defaultLang));
  if (args.flags.json) {
    printJson(hits);
    return 0;
  }
  if (!hits.length) print(c.dim("no matches"));
  for (const h of hits) print(`${c.bold(h.title)}  ${c.dim(`${h.id} · ${h.type} · ${h.path}`)}`, `  ${h.snippet}`);
  return 0;
}

/** A note plus its neighbourhood as Markdown, ready to paste into a model's context; null if no note matches. */
export async function contextMarkdown(vault: Vault, id: string, hops: number, lang: string): Promise<string | null> {
  const ctx = vault.context(id, hops, lang);
  if (ctx.error) return null;
  const source = await Bun.file(join(vault.root, ctx.note.path)).text();
  const out: string[] = [];
  out.push(`# ${ctx.note.title} (${ctx.note.id}, ${ctx.note.type})`, "", `path: ${ctx.note.path}`, "", source.trim(), "");
  const byId = new Map<string, any>(ctx.neighbours.map((n: any) => [n.id, n]));
  if (ctx.relations.length) {
    out.push("## Direct relations", "");
    for (const r of ctx.relations) {
      const n = byId.get(r.id);
      const arrow = r.direction === "out" ? "→" : "←";
      out.push(`- ${arrow} ${r.kind} **${n?.title ?? r.id}** (\`${r.id}\`): ${n?.summary ?? ""}`);
    }
    out.push("");
  }
  const further = ctx.neighbours.filter((n: any) => n.hop > 1);
  if (further.length) {
    out.push(`## Further notes (up to ${hops} hops)`, "");
    for (const n of further) out.push(`- **${n.title}** (\`${n.id}\`, ${n.type}, hop ${n.hop}): ${n.summary}`);
    out.push("");
  }
  if (ctx.wanted.length) out.push("## Wanted (linked but not written yet)", "", ...ctx.wanted.map((w: string) => `- ${w}`), "");
  return out.join("\n");
}

export async function context(vault: Vault, args: Args): Promise<number> {
  const id = requireId(args, "context");
  const hops = num(args.flags, "hops", 1);
  const lang = str(args.flags, "lang", vault.defaultLang)!;
  if (args.flags.json || str(args.flags, "format") === "json") {
    const ctx = vault.context(id, hops, lang);
    if (ctx.error) fail(`no note matches "${id}"`);
    const source = await Bun.file(join(vault.root, ctx.note.path)).text();
    printJson({ ...ctx, note: { ...ctx.note, source } });
    return 0;
  }
  const md = await contextMarkdown(vault, id, hops, lang);
  if (md === null) fail(`no note matches "${id}"`);
  print(md);
  return 0;
}

export async function resolveCmd(vault: Vault, args: Args): Promise<number> {
  const target = requireId(args, "resolve");
  vault.build();
  const r = vault.resolve(target);
  if (args.flags.json) printJson(r);
  else print(r ? `${r.id}  ${c.dim(r.path)}` : c.dim("no match"));
  return r ? 0 : 1;
}

export async function stats(vault: Vault, args: Args): Promise<number> {
  vault.build();
  const site = vault.site(str(args.flags, "lang", vault.defaultLang));
  if (args.flags.json) {
    printJson({ stats: site.stats, types: site.types, clusters: site.clusters.map((c: any) => ({ label: c.label, size: c.size })), lint: site.lint });
    return 0;
  }
  const s = site.stats;
  print(c.bold(site.title), `${s.notes} notes · ${s.files} files · ${s.edges} links · ${s.wanted} wanted · ${s.words} words · ${s.tags} tags`, "");
  print(c.bold("Types"), ...site.types.filter((t: any) => t.count).map((t: any) => `  ${pad(t.label, 10)} ${t.count}`), "");
  if (site.clusters.length) print(c.bold("Clusters"), ...site.clusters.map((cl: any) => `  ${pad(cl.label, 24)} ${cl.size}`));
  return 0;
}

export type { Diag };
