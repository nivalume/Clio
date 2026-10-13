/** `clio` command dispatcher. */
import { parseArgs, str, type Args } from "./args";
import * as read from "./commands/read";
import { c, fail, print } from "./ui";
import { Vault } from "./vault";

const VERSION = "0.1.0";

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
};

/** Commands that run without an opened vault. */
export const PLAIN_COMMANDS: Record<string, { run: (args: Args) => Promise<number>; help: string }> = {};

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
  const plain = PLAIN_COMMANDS[args.command];
  if (plain) return plain.run(args);
  const cmd = VAULT_COMMANDS[args.command];
  if (!cmd) fail(`unknown command "${args.command}"; run clio --help`);
  const vault = await Vault.open(str(args.flags, "dir", process.cwd())!);
  return cmd.run(vault, args);
}
