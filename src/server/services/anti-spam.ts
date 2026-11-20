import { createHmac } from "node:crypto";
import { safeEqual } from "../auth/crypto";

const MIN_FILL_MS = 3_000;
const MAX_FILL_MS = 2 * 60 * 60 * 1000;

function secret(): string {
  return process.env.AUTH_ENCRYPTION_KEY ?? "development-only-secret";
}

/** Signed render timestamp, checked on submit to catch instant bot posts. */
export function createFormToken(now = Date.now()): string {
  const ts = now.toString(36);
  const signature = createHmac("sha256", secret()).update(`form:${ts}`).digest("base64url").slice(0, 22);
  return `${ts}.${signature}`;
}

export type SpamVerdict = { ok: true } | { ok: false; reason: "honeypot" | "token" | "too_fast" | "too_slow" | "turnstile" };

export function checkFormToken(token: string, now = Date.now()): SpamVerdict {
  const [ts, signature] = token.split(".");
  if (!ts || !signature) return { ok: false, reason: "token" };
  const expected = createHmac("sha256", secret()).update(`form:${ts}`).digest("base64url").slice(0, 22);
  if (!safeEqual(signature, expected)) return { ok: false, reason: "token" };
  const elapsed = now - parseInt(ts, 36);
  if (elapsed < MIN_FILL_MS) return { ok: false, reason: "too_fast" };
  if (elapsed > MAX_FILL_MS) return { ok: false, reason: "too_slow" };
  return { ok: true };
}

export function turnstileSiteKey(): string | null {
  return process.env.TURNSTILE_SITE_KEY || null;
}

/** Cloudflare Turnstile server side check, skipped when no secret is configured. */
export async function verifyTurnstile(response: string | null, ip: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return true;
  if (!response) return false;
  try {
    const body = new URLSearchParams({ secret: secretKey, response, remoteip: ip });
    const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await result.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    // Network issue on Cloudflare side: the other layers still apply.
    return true;
  }
}

/** Runs every anti spam layer except rate limiting. */
export async function checkSubmission(formData: FormData, ip: string): Promise<SpamVerdict> {
  if (String(formData.get("website") ?? "") !== "") return { ok: false, reason: "honeypot" };
  const token = checkFormToken(String(formData.get("formToken") ?? ""));
  if (!token.ok) return token;
  const turnstile = await verifyTurnstile(formData.get("cf-turnstile-response")?.toString() ?? null, ip);
  return turnstile ? { ok: true } : { ok: false, reason: "turnstile" };
}
