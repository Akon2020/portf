import { readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const dir = () => process.env.MAIL_OUTBOX_DIR!;

export async function clearOutbox(): Promise<void> {
  await rm(dir(), { recursive: true, force: true });
}

/** Raw .eml files written by the outbox transport, oldest first. */
export async function readOutbox(): Promise<string[]> {
  let files: string[];
  try {
    files = (await readdir(dir())).sort();
  } catch {
    return [];
  }
  return Promise.all(files.map((file) => readFile(join(dir(), file), "utf8")));
}

/** Decodes quoted-printable soft line breaks so links can be searched. */
export function decodeEml(raw: string): string {
  return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}
