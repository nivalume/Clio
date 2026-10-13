/** `clio build`, `clio serve`, `clio dev`. */
import { existsSync, statSync, watch } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { num, str, type Args } from "../args";
import { loadSettings, normaliseBase } from "../config";
import { findRoot, ignored, Vault } from "../vault";
import { buildSite, type BuildResult } from "../site/build";
import { c, fail, print, printJson } from "../ui";

function report(r: BuildResult, root: string): void {
  print(
    `${c.green("built")} ${r.pages} pages (${r.notes} notes) → ${relative(process.cwd(), r.out) || "."} in ${(r.ms / 1000).toFixed(1)} s`,
    c.dim(`  ${r.assets} images · render cache ${r.cache.hits} hit / ${r.cache.misses} new · ${r.errors} errors, ${r.warnings} warnings${r.errors || r.warnings ? ` (clio check --dir ${relative(process.cwd(), root) || "."})` : ""}`),
  );
}

export async function build(vault: Vault, args: Args): Promise<number> {
  const out = str(args.flags, "out");
  const r = await buildSite(vault, {
    out: out ? resolve(out) : undefined,
    search: !args.flags["no-search"],
    cache: !args.flags["no-cache"],
    log: (l) => print(c.dim(l)),
  });
  if (args.flags.json) printJson(r);
  else report(r, vault.root);
  return args.flags.strict && r.errors ? 1 : 0;
}

/** Static file server with the same URL rules as the hosts: `/a` → `a.html` or `a/index.html`, else 404.html. */
function serveDir(dir: string, port: number, base: string, inject = ""): ReturnType<typeof Bun.serve> {
  const find = (pathname: string): string | null => {
    let p: string;
    try {
      p = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    const file = resolve(dir, `.${p}`);
    if (!file.startsWith(resolve(dir))) return null;
    for (const f of [file, `${file}.html`, join(file, "index.html")]) {
      try {
        if (statSync(f).isFile()) return f;
      } catch {
        /* next */
      }
    }
    return null;
  };
  const respond = async (file: string, status = 200) => {
    if (inject && file.endsWith(".html")) {
      const html = (await Bun.file(file).text()).replace("</body>", `${inject}</body>`);
      return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    return new Response(Bun.file(file), { status, headers: { "cache-control": "no-store" } });
  };
  const listen = (): ReturnType<typeof Bun.serve> => {
    try {
      return Bun.serve({ port, fetch });
    } catch (e) {
      if (String(e).includes("EADDRINUSE") || String((e as { code?: string }).code) === "EADDRINUSE") {
        throw new Error(`port ${port} is in use; pick another with --port`);
      }
      throw e;
    }
  };
  // The site lives under `base` (e.g. /kb/); files are at the root of the output folder.
  const fetch = async (req: Request) => {
    const url = new URL(req.url);
    let path = url.pathname;
    if (base !== "/") {
      if (path === "/" || path === base.slice(0, -1)) return Response.redirect(base, 302);
      if (!path.startsWith(base)) return new Response("not found (the site is served under " + base + ")", { status: 404 });
      path = `/${path.slice(base.length)}`;
    }
    {
      const file = find(path);
      if (file) return respond(file);
      const notFound = join(dir, "404.html");
      if (existsSync(notFound)) return respond(notFound, 404);
      return new Response("not found", { status: 404 });
    }
  };
  return listen();
}

/** Serves the last build; reads only the settings, not the notes. */
export async function serve(args: Args): Promise<number> {
  const root = findRoot(str(args.flags, "dir", process.cwd())!);
  const settings = await loadSettings(root);
  const base = normaliseBase(str(args.flags, "base") ?? settings.engine.base);
  const dir = resolve(str(args.flags, "out") ?? join(root, ".clio/site"));
  if (!existsSync(join(dir, "index.html"))) fail(`nothing built in ${dir}; run clio build first`);
  const server = serveDir(dir, num(args.flags, "port", 4321), base);
  print(`serving ${relative(process.cwd(), dir) || "."} at ${c.cyan(`http://localhost:${server.port}${base}`)}`);
  await new Promise(() => {});
  return 0;
}

/** Build, serve, and rebuild when notes change; open pages reload themselves. */
export async function dev(first: Vault, args: Args): Promise<number> {
  let vault = first;
  const out = resolve(str(args.flags, "out") ?? join(vault.root, ".clio/dev"));
  const search = Boolean(args.flags.search);
  const clients = new Set<ReadableStreamDefaultController<string>>();
  const events = Bun.serve({
    port: 0,
    fetch() {
      let ctrl: ReadableStreamDefaultController<string>;
      const stream = new ReadableStream<string>({
        start(c) {
          ctrl = c;
          clients.add(c);
          c.enqueue(": hello\n\n");
        },
        cancel() {
          clients.delete(ctrl);
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", "access-control-allow-origin": "*" } });
    },
  });
  const inject = `<script>new EventSource("http://localhost:${events.port}/").addEventListener("reload",()=>location.reload())</script>`;

  const rebuild = async () => {
    const r = await buildSite(vault, { out, search, log: (l) => print(c.dim(l)) });
    report(r, vault.root);
    for (const ctl of clients) ctl.enqueue("event: reload\ndata: 1\n\n");
  };
  await rebuild();
  const server = serveDir(out, num(args.flags, "port", 4321), vault.settings.engine.base, inject);
  print(`dev server at ${c.cyan(`http://localhost:${server.port}${vault.settings.engine.base}`)} (watching ${relative(process.cwd(), vault.root) || "."})`);

  let pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = Promise.resolve();
  const flush = () => {
    const changed = [...pending];
    pending = new Set();
    running = running.then(async () => {
      try {
        if (changed.some((p) => p === "clio.toml" || p.startsWith("clio.config."))) {
          vault = await Vault.open(vault.root);
        } else {
          for (const p of changed) if (p.endsWith(".md")) await vault.refresh(p);
        }
        await rebuild();
      } catch (e) {
        print(c.red(`build failed: ${e instanceof Error ? e.message : e}`));
      }
    });
  };
  watch(vault.root, { recursive: true }, (_event, name) => {
    if (!name) return;
    const path = String(name).split(sep).join("/");
    const relevant = path === "clio.toml" || path.startsWith("clio.config.") || path.startsWith("theme/") || (path.endsWith(".md") && !ignored(path, vault.settings.ignore)) || /\.(png|jpe?g|gif|svg|webp)$/i.test(path);
    if (!relevant || path.startsWith(".clio/") || path.includes("node_modules/")) return;
    pending.add(path);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 120);
  });
  await new Promise(() => {});
  return 0;
}
