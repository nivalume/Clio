/**
 * Build the web app (packages/web, Vite under Node) into packages/clio/web,
 * which is committed so installs from GitHub need no build step.
 * `--check` only verifies the committed app matches its sources.
 */
import { $ } from "bun";
import { webSourceHash } from "./source-hash";

const root = new URL("..", import.meta.url).pathname;
const out = `${root}packages/clio/web`;
const hash = await webSourceHash(root);

if (process.argv.includes("--check")) {
  const committed = (await Bun.file(`${out}/SOURCE_HASH`).text().catch(() => "")).trim();
  if (committed !== hash) {
    console.error(`packages/clio/web is stale: built from ${committed || "(unknown)"}, sources are ${hash}. Run: bun run build:web`);
    process.exit(1);
  }
  console.log(`packages/clio/web is current (${hash})`);
  process.exit(0);
}

const vite = `${root}packages/web/node_modules/.bin/vite`;
await $`node ${vite} build`.cwd(`${root}packages/web`);
await Bun.write(`${out}/SOURCE_HASH`, hash + "\n");
console.log(`web app built, source ${hash}`);
