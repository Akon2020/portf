import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

const OUTBOX = ".tmp-e2e/outbox";

/** Decoded text of the e-mails written to the outbox, most recent first. */
export function readMails(): string[] {
  let files: string[] = [];
  try {
    files = readdirSync(OUTBOX).filter((file) => file.endsWith(".eml"));
  } catch {
    return [];
  }
  return files
    .map((file) => join(OUTBOX, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
    .map((file) =>
      readFileSync(file, "utf8")
        // Quoted printable soft line breaks and encoded equal signs.
        .replace(/=\r?\n/g, "")
        .replace(/=3D/g, "="),
    );
}

export async function waitForMail(predicate: (mail: string) => boolean, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const mail = readMails().find(predicate);
    if (mail) return mail;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("E-mail attendu introuvable dans la boîte de sortie.");
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();
}

/** Fails when the page scrolls horizontally (the layout overflows the viewport). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}
