import { EOL } from "node:os";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const NEWLINE = String.fromCharCode(10);

let pipedLines: string[] | undefined;

/** When stdin is piped (CI, scripts), all lines are read once and served in order. */
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const chunks: Buffer[] = [];
    for await (const chunk of stdin) chunks.push(chunk as Buffer);
    pipedLines = Buffer.concat(chunks).toString("utf8").split(NEWLINE);
  }
  return (pipedLines.shift() ?? "").trim();
}

/** Line based prompt. Input is hidden when asked and when stdin is a terminal. */
export async function ask(question: string, options: { hidden?: boolean; defaultValue?: string } = {}) {
  const suffix = options.defaultValue ? ` [${options.defaultValue}]` : "";
  if (!stdin.isTTY) {
    stdout.write(`${question}${suffix} :${EOL}`);
    return (await nextPipedLine()) || options.defaultValue || "";
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  if (options.hidden) {
    const output = rl as unknown as { _writeToOutput: (text: string) => void };
    const original = output._writeToOutput.bind(rl);
    let prompted = false;
    output._writeToOutput = (text: string) => {
      // Only the question itself is echoed, typed characters stay hidden.
      if (!prompted) {
        original(text);
        prompted = true;
      }
    };
  }
  const answer = await rl.question(`${question}${suffix} : `);
  if (options.hidden) stdout.write(EOL);
  rl.close();
  return answer.trim() || options.defaultValue || "";
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (o/N)`);
  return ["o", "oui", "y", "yes"].includes(answer.toLowerCase());
}
