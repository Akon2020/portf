import { EOL } from "node:os";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

const NEWLINE = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);
const CTRL_C = String.fromCharCode(3);
const CTRL_D = String.fromCharCode(4);
const BACKSPACE = String.fromCharCode(8);
const DELETE = String.fromCharCode(127);

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

/**
 * Reads a secret in raw terminal mode: every typed character is shown as "*",
 * backspace removes the last one, Ctrl+C cancels. Uses public APIs only.
 */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    let value = "";

    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stdout.write(EOL);
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === CARRIAGE_RETURN || char === NEWLINE || char === CTRL_D) return finish();
        if (char === CTRL_C) return finish(new Error("Saisie annulée."));
        if (char === BACKSPACE || char === DELETE) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write(`${BACKSPACE} ${BACKSPACE}`);
          }
          continue;
        }
        // Control characters and escape sequences (arrow keys) are ignored.
        if (char.charCodeAt(0) < 32) continue;
        value += char;
        stdout.write("*");
      }
    };

    stdin.on("data", onData);
  });
}

/** Line based prompt. Input is hidden when asked and when stdin is a terminal. */
export async function ask(question: string, options: { hidden?: boolean; defaultValue?: string } = {}) {
  const suffix = options.defaultValue ? ` [${options.defaultValue}]` : "";
  if (!stdin.isTTY) {
    stdout.write(`${question}${suffix} :${EOL}`);
    return (await nextPipedLine()) || options.defaultValue || "";
  }

  if (options.hidden) {
    const answer = await askHidden(`${question}${suffix} : `);
    return answer.trim() || options.defaultValue || "";
  }

  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const answer = await rl.question(`${question}${suffix} : `);
  rl.close();
  return answer.trim() || options.defaultValue || "";
}

export async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (o/N)`);
  return ["o", "oui", "y", "yes"].includes(answer.toLowerCase());
}
