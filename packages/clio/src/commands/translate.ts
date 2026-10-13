/** `clio translate-status`: missing, unpinned and stale translations; `--pin` records the hash a translation now matches. */
import { join } from "node:path";
import { str, type Args } from "../args";
import { c, pad, print, printJson } from "../ui";
import type { Vault } from "../vault";

export interface TranslationRow {
  id: string;
  title: string;
  path: string;
  lang: string;
  hash: string;
  translations: { lang: string; status: "missing" | "unpinned" | "stale" | "current"; path: string | null; translationOfHash?: string | null }[];
}

/** Set `translation-of-hash` in a file's frontmatter (added if absent). */
export function pinHash(text: string, hash: string): string {
  const line = `translation-of-hash: "${hash}"`;
  const m = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!m) return `---\n${line}\n---\n\n${text}`;
  const fm = m[1];
  const next = /^translation-of-hash:.*$/m.test(fm) ? fm.replace(/^translation-of-hash:.*$/m, line) : `${fm}\n${line}`;
  return `---\n${next}\n---${m[2]}${text.slice(m[0].length)}`;
}

export async function translateStatus(vault: Vault, args: Args): Promise<number> {
  const rows = vault.engine.command<TranslationRow[]>({ cmd: "translations" });
  const only = str(args.flags, "lang");
  const pin = str(args.flags, "pin");
  if (pin) {
    const ids = new Set(pin.split(",").map((s) => s.trim()).filter(Boolean));
    let n = 0;
    for (const r of rows) {
      if (!ids.has(r.id)) continue;
      for (const t of r.translations) {
        if (!t.path || (only && t.lang !== only) || t.status === "current") continue;
        const file = join(vault.root, t.path);
        await Bun.write(file, pinHash(await Bun.file(file).text(), r.hash));
        print(`${c.green("pinned")} ${t.path} → ${r.hash}`);
        n++;
      }
      ids.delete(r.id);
    }
    for (const id of ids) print(c.yellow(`no note with id ${id}`));
    if (!n) print(c.dim("nothing to pin"));
    return 0;
  }
  const items = rows.flatMap((r) => r.translations.filter((t) => !only || t.lang === only).map((t) => ({ ...t, source: r })));
  if (args.flags.json) {
    printJson(items.filter((t) => t.status !== "current").map((t) => ({ id: t.source.id, source: t.source.path, lang: t.lang, status: t.status, path: t.path, hash: t.source.hash, translationOfHash: t.translationOfHash ?? null })));
    return 0;
  }
  const groups = { missing: [] as string[], unpinned: [] as string[], stale: [] as string[] };
  for (const t of items) {
    if (t.status === "missing") groups.missing.push(`  ${pad(t.source.path, 40)} ${t.lang}`);
    else if (t.status === "unpinned") groups.unpinned.push(`  ${pad(t.path!, 40)} translation-of-hash: "${t.source.hash}"`);
    else if (t.status === "stale") groups.stale.push(`  ${pad(t.path!, 40)} translation-of-hash: "${t.source.hash}"`);
  }
  const current = items.filter((t) => t.status === "current").length;
  for (const [name, lines] of Object.entries(groups)) {
    if (lines.length) print(`${c.bold(name)} (${lines.length})`, ...lines);
  }
  print(c.dim(`${current} current · after updating a translation: clio translate-status --pin <id>`));
  return 0;
}
