/**
 * `clio mcp`: a Model Context Protocol server on stdio (newline-delimited
 * JSON-RPC 2.0). Tools mirror the read commands; results are the same JSON.
 * Before each call the vault is synced with the files on disk, so edits the
 * agent makes between calls are seen. Logs go to stderr.
 */
import { createInterface } from "node:readline";
import type { Args } from "../args";
import { VERSION } from "../files";
import type { Vault } from "../vault";
import { contextMarkdown } from "./read";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(vault: Vault, a: Record<string, any>): Promise<unknown>;
}

const lang = { type: "string", description: "Language of the result (default: the vault's first locale)" };

const TOOLS: Tool[] = [
  {
    name: "search",
    description: "Full-text search over the notes (BM25; Chinese and English). Returns id, title, type, path, score and a snippet per hit, best first.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 }, lang }, required: ["query"] },
    async run(vault, a) {
      vault.build();
      return vault.search(String(a.query), Number(a.limit ?? 10), a.lang ?? vault.defaultLang);
    },
  },
  {
    name: "show",
    description: "A note's metadata, outline, typed relations in both directions, backlinks and translations. Accepts an id, alias or title.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, lang }, required: ["id"] },
    async run(vault, a) {
      const p = vault.page(String(a.id), a.lang ?? vault.defaultLang);
      if (p.error) throw new Error(`no note matches "${a.id}"`);
      const { html: _h, plugins: _p, ...rest } = p;
      return rest;
    },
  },
  {
    name: "backlinks",
    description: "What points to a note: incoming typed relations grouped by label, and plain links with the text around each link.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, lang }, required: ["id"] },
    async run(vault, a) {
      const p = vault.page(String(a.id), a.lang ?? vault.defaultLang);
      if (p.error) throw new Error(`no note matches "${a.id}"`);
      return { id: p.id, relations: p.relations.filter((r) => r.direction === "in"), backlinks: p.backlinks };
    },
  },
  {
    name: "context",
    description: "A note's full Markdown source plus its neighbourhood (related notes with summaries, notes within `hops`, wanted links), as Markdown ready to read.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, hops: { type: "integer", minimum: 1, maximum: 3 }, lang }, required: ["id"] },
    async run(vault, a) {
      const md = await contextMarkdown(vault, String(a.id), Number(a.hops ?? 1), a.lang ?? vault.defaultLang);
      if (md === null) throw new Error(`no note matches "${a.id}"`);
      return md;
    },
  },
  {
    name: "check",
    description: "Lint the vault: broken and ambiguous links, missing anchors, bad frontmatter, modified raw files, stale translations. `all` adds notices (orphans, stale notes).",
    inputSchema: { type: "object", properties: { all: { type: "boolean" } } },
    async run(vault, a) {
      const summary = vault.build();
      const diags = vault.lint().filter((d) => a.all || d.level !== "info");
      return { summary, diags };
    },
  },
];

type Message = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: any };

export async function mcp(vault: Vault, _args: Args): Promise<number> {
  const send = (msg: unknown) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const log = (s: string) => process.stderr.write(`[clio mcp] ${s}\n`);
  log(`serving ${vault.root}`);

  const handle = async (m: Message): Promise<unknown> => {
    switch (m.method) {
      case "initialize": {
        const asked = m.params?.protocolVersion;
        return {
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "clio", version: VERSION },
          instructions: "Tools for a Clio knowledge base: search notes, read a note with its neighbourhood (context), list relations and backlinks (show, backlinks), and lint (check). Edit notes as files; run check before finishing.",
        };
      }
      case "ping":
        return {};
      case "tools/list":
        return { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) };
      case "tools/call": {
        const tool = TOOLS.find((t) => t.name === m.params?.name);
        if (!tool) throw Object.assign(new Error(`unknown tool ${m.params?.name}`), { code: -32602 });
        try {
          await vault.sync();
          const result = await tool.run(vault, m.params?.arguments ?? {});
          const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return typeof result === "string" ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text }], structuredContent: Array.isArray(result) ? { items: result } : result };
        } catch (e) {
          return { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true };
        }
      }
      default:
        throw Object.assign(new Error(`method not found: ${m.method}`), { code: -32601 });
    }
  };

  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  let queue = Promise.resolve();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    queue = queue.then(async () => {
      let msg: Message;
      try {
        msg = JSON.parse(line);
      } catch {
        send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
        return;
      }
      if (msg.id === undefined || msg.id === null) return; // a notification
      try {
        send({ jsonrpc: "2.0", id: msg.id, result: await handle(msg) });
      } catch (e: any) {
        send({ jsonrpc: "2.0", id: msg.id, error: { code: e?.code ?? -32603, message: e instanceof Error ? e.message : String(e) } });
      }
    });
  });
  await new Promise<void>((done) => rl.on("close", () => queue.then(() => done())));
  return 0;
}
