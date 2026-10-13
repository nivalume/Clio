/**
 * Build the engine for wasm32 and copy it into packages/clio/engine/, next to
 * a SOURCE_HASH file. `--check` only verifies the committed module is current.
 */
import { $ } from "bun";
import { engineSourceHash } from "./source-hash";

const root = new URL("..", import.meta.url).pathname;
const out = `${root}packages/clio/engine`;
const hash = await engineSourceHash(root);

if (process.argv.includes("--check")) {
  const committed = (await Bun.file(`${out}/SOURCE_HASH`).text().catch(() => "")).trim();
  if (committed !== hash) {
    console.error(`clio.wasm is stale: built from ${committed || "(unknown)"}, sources are ${hash}. Run: bun run build:wasm`);
    process.exit(1);
  }
  console.log(`clio.wasm is current (${hash})`);
  process.exit(0);
}

// Strip machine-specific paths so the module is byte-identical wherever it is built.
const cargoHome = process.env.CARGO_HOME ?? `${process.env.HOME}/.cargo`;
const rustflags = `--remap-path-prefix=${cargoHome}=/cargo --remap-path-prefix=${root.replace(/\/$/, "")}=/clio`;
await $`cargo build -p clio-wasm --target wasm32-unknown-unknown --profile release-wasm`.cwd(root).env({ ...process.env, RUSTFLAGS: rustflags });
await $`cp ${root}target/wasm32-unknown-unknown/release-wasm/clio_wasm.wasm ${out}/clio.wasm`;
await Bun.write(`${out}/SOURCE_HASH`, hash + "\n");
const size = Bun.file(`${out}/clio.wasm`).size;
console.log(`clio.wasm ${(size / 1024).toFixed(0)} KB, source ${hash}`);
