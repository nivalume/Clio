#!/usr/bin/env bun
import { main } from "../src/cli";

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  // Expected failures print one line; CLIO_DEBUG=1 shows the stack.
  if (process.env.CLIO_DEBUG) throw e;
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`${process.stderr.isTTY && !process.env.NO_COLOR ? "\x1b[31merror\x1b[39m" : "error"} ${msg}\n`);
  process.exitCode = 1;
}
