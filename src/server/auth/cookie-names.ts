import type { SessionKind } from "../db/schema";

/**
 * The __Host- prefix requires Secure, which browsers refuse on plain http.
 * Production always runs behind HTTPS, development uses unprefixed names.
 */
export const SECURE_COOKIES = process.env.NODE_ENV === "production";

export const SESSION_COOKIES: Record<SessionKind, string> = SECURE_COOKIES
  ? { admin: "__Host-session", client: "__Host-client" }
  : { admin: "session", client: "client" };
