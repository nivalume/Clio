# AGENTS.md

Instructions for coding agents working on the Clio repository (Claude Code reads this through `CLAUDE.md`).

## What this is

Clio: a knowledge base for the agent era. Rust engine (`crates/clio-core`) compiled to WebAssembly and run by a Bun CLI
(`packages/clio`), a React app (`packages/web`), an agent skill (`skills/clio`), starters (`starters/`), and the
handbook (`docs/`, itself a Clio vault). Read `README.en.md`, then the handbook's architecture page
(`docs/concepts/architecture.en.md`).

## Commands

```bash
cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
bun install && bun test && bun run typecheck
bun run build:wasm        # after any change under crates/ (commits packages/clio/engine/clio.wasm + SOURCE_HASH)
bun run build:web         # after any change under packages/web/ (commits packages/clio/web/)
bun run check:fresh       # CI fails when either is stale
bun run check             # lint the handbook
bun bench/run.ts 20000    # engine, build and layout timings on a synthetic 20k-note vault (minutes)
```

## Rules that are easy to break

- Engine output is deterministic: no hash-map iteration order in output (use BTreeMap or sort), floats summed in a
  fixed order. Native and wasm builds must give identical output (`packages/clio/test/engine.test.ts`).
- Syntax snapshot tests live in `crates/clio-core/tests/syntax/`; update them with `UPDATE_SNAPSHOTS=1` only when the
  change is intended, and read the diff.
- The engine never touches the file system; Bun reads files and passes text in.
- Raw HTML in notes is dropped, never passed through.
- Starter files avoid dot names (`gitignore`, `github/`); `clio new site` restores them.
- Handbook pages exist in Chinese (`x.md`) and English (`x.en.md`). After editing a Chinese page, update the English
  one and pin it: `bun packages/clio/bin/clio.ts translate-status --dir docs --pin <id>`.

## Skills

`skills/clio` is the agent skill shipped to users; it is linked into `.claude/skills/` and `.agents/skills/` here too,
so agents editing `docs/` can use it.
