/**
 * Loads the Clio engine (Rust compiled to WebAssembly) and passes strings in
 * and out through its linear memory. One instance per process; the engine is
 * single-threaded and deterministic.
 */
const ENGINE_URL = new URL("../engine/clio.wasm", import.meta.url);

type Exports = {
  memory: WebAssembly.Memory;
  clio_alloc(len: number): number;
  clio_free(ptr: number, len: number): void;
  [fn: string]: unknown;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class Wasm {
  private constructor(private readonly ex: Exports) {}

  static async load(path: string | URL = ENGINE_URL): Promise<Wasm> {
    const bytes = await Bun.file(path).arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return new Wasm(instance.exports as unknown as Exports);
  }

  /** Call an export taking (ptr, len) pairs of UTF-8 strings and returning a packed (ptr << 32 | len) string. */
  call(fn: string, ...args: string[]): string {
    const ex = this.ex;
    const owned: [number, number][] = [];
    const flat: number[] = [];
    for (const arg of args) {
      const bytes = encoder.encode(arg);
      const ptr = ex.clio_alloc(bytes.length);
      // Re-read memory.buffer after every allocation: growth detaches the old buffer.
      new Uint8Array(ex.memory.buffer, ptr, bytes.length).set(bytes);
      owned.push([ptr, bytes.length]);
      flat.push(ptr, bytes.length);
    }
    const f = ex[fn] as (...a: number[]) => bigint;
    if (typeof f !== "function") throw new Error(`engine has no export ${fn}`);
    const packed = BigInt.asUintN(64, f(...flat));
    for (const [ptr, len] of owned) ex.clio_free(ptr, len);
    const ptr = Number(packed >> 32n);
    const len = Number(packed & 0xffffffffn);
    const out = decoder.decode(new Uint8Array(ex.memory.buffer, ptr, len));
    ex.clio_free(ptr, len);
    return out;
  }
}
