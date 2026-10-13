/**
 * The Clio engine as seen from Bun: a JSON command channel to the Rust core
 * compiled to WebAssembly (default) or to the native `clio-native` binary.
 */
import { Wasm } from "./wasm";

export interface EngineLike {
  command<T = unknown>(cmd: Record<string, unknown>): T;
  upsert(path: string, text: string): void;
}

export class EngineError extends Error {}

export class Engine implements EngineLike {
  private constructor(private readonly wasm: Wasm) {}

  static async load(path?: string | URL): Promise<Engine> {
    return new Engine(await Wasm.load(path));
  }

  /** The engine's reply exactly as it produced it (JSON text). */
  commandRaw(cmd: Record<string, unknown> | string): string {
    return this.wasm.call("clio_command", typeof cmd === "string" ? cmd : JSON.stringify(cmd));
  }

  command<T = unknown>(cmd: Record<string, unknown>): T {
    const reply = JSON.parse(this.commandRaw(cmd));
    if (reply && typeof reply === "object" && "error" in reply) throw new EngineError(String(reply.error));
    return reply as T;
  }

  upsert(path: string, text: string): void {
    this.wasm.call("clio_upsert", path, text);
  }
}
