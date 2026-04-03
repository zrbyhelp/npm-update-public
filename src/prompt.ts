import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

export async function ask(question: string): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    return await rl.question(question);
  } finally {
    rl.close();
  }
}
