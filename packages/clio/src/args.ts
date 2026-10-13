/** Minimal argument parser: `clio <command> [positionals] [--flag value] [--switch]`. */

const VALUED = new Set([
  "dir", "lang", "limit", "hops", "format", "starter", "out", "port", "type", "title", "id", "tags", "level", "engine", "base", "locales", "message", "op", "pin", "clio-dep",
]);

export interface Args {
  command: string;
  positionals: string[];
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
      if (eq > 0) flags[name] = a.slice(eq + 1);
      else if (VALUED.has(name) && i + 1 < argv.length) flags[name] = argv[++i];
      else flags[name] = true;
    } else if (a.startsWith("-") && a.length === 2) {
      const short: Record<string, string> = { h: "help", v: "version", j: "json" };
      flags[short[a[1]] ?? a[1]] = true;
    } else {
      positionals.push(a);
    }
  }
  const command = positionals.shift() ?? "";
  return { command, positionals, flags };
}

export function str(flags: Args["flags"], name: string, fallback?: string): string | undefined {
  const v = flags[name];
  return typeof v === "string" ? v : fallback;
}

export function num(flags: Args["flags"], name: string, fallback: number): number {
  const v = flags[name];
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}
