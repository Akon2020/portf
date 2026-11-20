import { cookies } from "next/headers";
import { cache } from "react";
import type { SessionKind } from "../db/schema";
import { SECURE_COOKIES, SESSION_COOKIES } from "./cookie-names";
import { SESSION_POLICIES } from "./policy";
import { validateSessionToken, type ValidatedSession } from "./session-store";

export { SESSION_COOKIES };

export async function setSessionCookie(kind: SessionKind, token: string, maxAgeMs?: number) {
  const store = await cookies();
  store.set(SESSION_COOKIES[kind], token, {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax",
    path: "/",
    // The database enforces the sliding expiry, the cookie lives until the absolute limit.
    maxAge: Math.floor((maxAgeMs ?? SESSION_POLICIES[kind].absolute) / 1000),
  });
}

export async function clearSessionCookie(kind: SessionKind) {
  const store = await cookies();
  store.delete(SESSION_COOKIES[kind]);
}

export async function readSessionToken(kind: SessionKind): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIES[kind])?.value ?? null;
}

/** Validated session for the current request, cached per request. */
export const getSession = cache(async (kind: SessionKind): Promise<ValidatedSession | null> => {
  const token = await readSessionToken(kind);
  if (!token) return null;
  return validateSessionToken(token, kind);
});
