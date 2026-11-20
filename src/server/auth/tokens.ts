import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { authTokens, authTokenType } from "../db/schema";
import { generateToken, sha256 } from "./crypto";

export type AuthTokenType = (typeof authTokenType.enumValues)[number];

export const AUTH_TOKEN_TTL_MINUTES: Record<AuthTokenType, number> = {
  magic_link: 15,
  password_reset: 30,
  email_change: 60,
  invite: 7 * 24 * 60,
};

export interface IssueTokenInput {
  type: AuthTokenType;
  email: string;
  userId?: string | null;
  requestIp?: string | null;
  meta?: Record<string, unknown>;
}

/**
 * Issues a single use token. Previous unused tokens of the same type for the
 * same e-mail are invalidated. Only the hash is stored.
 */
export async function issueAuthToken(input: IssueTokenInput): Promise<string> {
  const token = generateToken(32);
  const email = input.email.trim().toLowerCase();
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(eq(authTokens.email, email), eq(authTokens.type, input.type), isNull(authTokens.usedAt)),
      );
    await tx.insert(authTokens).values({
      type: input.type,
      tokenHash: sha256(token),
      email,
      userId: input.userId ?? null,
      expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MINUTES[input.type] * 60_000),
      requestIp: input.requestIp ?? null,
      meta: input.meta ?? null,
    });
  });
  return token;
}

/** Atomically marks a token as used. Returns the token row or null when invalid. */
export async function consumeAuthToken(token: string, type: AuthTokenType) {
  if (!token || token.length > 128) return null;
  const now = new Date();
  const [row] = await getDb()
    .update(authTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .returning();
  return row ?? null;
}

/** Checks a token without consuming it, for confirmation pages. */
export async function peekAuthToken(token: string, type: AuthTokenType) {
  if (!token || token.length > 128) return null;
  const [row] = await getDb()
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, sha256(token)),
        eq(authTokens.type, type),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}
