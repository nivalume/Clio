/** `clio` command dispatcher. */
import { parseArgs, str, type Args } from "./args";
import * as read from "./commands/read";
import * as site from "./commands/site";
import { translateStatus } from "./commands/translate";
import * as project from "./commands/project";
import * as write from "./commands/write";
import { mcp } from "./commands/mcp";
import { VERSION } from "./files";
import { c, fail, print } from "./ui";
import { Vault } from "./vault";


type Handler = (vault: Vault, args: Args) => Promise<number>;

/** Commands that need an opened vault. More are added by later modules. */
export const VAULT_COMMANDS: Record<string, { run: Handler; help: string }> = {
  check: { run: read.check, help: "validate notes and links; exit 1 on errors (--strict: also warnings, --all: show notices)" },
  lint: { run: read.check, help: "same as check" },
  show: { run: read.show, help: "a note's metadata, sections and relations" },
  backlinks: { run: read.backlinks, help: "what links to a note, grouped by relation" },
  search: { run: read.search, help: "full-text search (BM25; Chinese and English)" },
  context: { run: read.context, help: "a note and its neighbours as Markdown for a language model (--hops N)" },
  resolve: { run: read.resolveCmd, help: "which note an id, alias or title points to" },
  stats: { run: read.stats, help: "counts by type, clusters, lint totals" },
  new: { run: project.newNote, help: 'a note from templates/<type>.md: clio new <type> "<title>" [--id ID] [--tags a,b] [--lang en]' },
  ingest: { run: write.ingest, help: "copy a file or URL into raw/, record its sha256, draft a source note, log it" },
  log: { run: write.log, help: 'append "## [date] op | title" to log.md' },
  mv: { run: write.mv, help: "rename a note's id and rewrite every link to it" },
  mcp: { run: mcp, help: "MCP server on stdio: search, show, backlinks, context, check" },
  "translate-status": { run: translateStatus, help: "missing and stale translations; --pin <id,…> records the current source hash" },
  build: { run: site.build, help: "write the static site to .clio/site (--out DIR, --base /path/, --no-search)" },
  dev: { run: site.dev, help: "build, serve and rebuild on change (--port 4321, --search)" },
};

/** Commands that run without an opened vault. */
export const PLAIN_COMMANDS: Record<string, { run: (args: Args) => Promise<number>; help: string }> = {
  "new site": { run: project.newSite, help: "create a project: clio new site <dir> [--starter llm-wiki|docs|blank] [--locales zh,en] [--title T]" },
  serve: { run: site.serve, help: "serve the last build (--port 4321)" },
  init: { run: project.init, help: "set up clio.toml, AGENTS.md and the agent skill here (--adopt for an Obsidian vault)" },
};

function help(): void {
  const rows = [...Object.entries(PLAIN_COMMANDS), ...Object.entries(VAULT_COMMANDS)];
  print(
    `${c.bold("clio")} ${VERSION}: a knowledge base for the agent era`,
    "",
    "usage: clio <command> [arguments] [--dir <vault>] [--json] [--lang <lang>]",
    "",
    ...rows.map(([name, cmd]) => `  ${name.padEnd(18)}${cmd.help}`),
    "",
    "Run inside a vault (a folder with clio.toml) or pass --dir.",
  );
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args.flags.version) {
    print(VERSION);
    return 0;
  }
  if (!args.command || args.flags.help || args.command === "help") {
    help();
    return 0;
  }
  const plain = PLAIN_COMMANDS[args.command === "new" && args.positionals[0] === "site" ? "new site" : args.command];
  if (plain) return plain.run(args);
  const cmd = VAULT_COMMANDS[args.command];
  if (!cmd) fail(`unknown command "${args.command}"; run clio --help`);
  const vault = await Vault.open(str(args.flags, "dir", process.cwd())!, { base: str(args.flags, "base") });
  return cmd.run(vault, args);
}
