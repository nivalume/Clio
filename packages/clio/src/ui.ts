/** Terminal output helpers. Colour only on a TTY and when NO_COLOR is unset. */
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open: number, close: number) => (s: string) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : s);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
};

export function print(...lines: string[]): void {
  process.stdout.write(lines.join("\n") + "\n");
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export function fail(message: string, code = 1): never {
  process.stderr.write(`${c.red("error")} ${message}\n`);
  process.exit(code);
}

export function pad(s: string, n: number): string {
  const width = [...s].reduce((w, ch) => w + (/[ᄀ-￿]/.test(ch) ? 2 : 1), 0);
  return s + " ".repeat(Math.max(0, n - width));
}
