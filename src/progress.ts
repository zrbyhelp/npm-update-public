import { stdout } from "node:process";

export class ProgressBar {
  #current = 0;

  constructor(private readonly total: number) {}

  tick(label: string): void {
    this.#current += 1;
    const safeTotal = Math.max(this.total, 1);
    const ratio = Math.min(this.#current / safeTotal, 1);
    const width = 20;
    const complete = Math.round(ratio * width);
    const bar = `${"#".repeat(complete)}${"-".repeat(width - complete)}`;
    const line = `[${bar}] ${this.#current}/${safeTotal} ${Math.round(ratio * 100)}% ${label}`;

    if (stdout.isTTY) {
      stdout.write(`\r${line}`);
      if (this.#current >= safeTotal) {
        stdout.write("\n");
      }
      return;
    }

    stdout.write(`${line}\n`);
  }
}
