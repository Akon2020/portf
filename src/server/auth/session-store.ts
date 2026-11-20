import { and, eq, isNull, ne } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users, type Session, type SessionKind, type User } from "../db/schema";
import { generateToken, sha256 } from "./crypto";
import {
  SESSION_POLICIES,
  initialSessionTimes,
  isSessionActive,
  nextSessionExpiry,
  type SessionPolicy,
} from "./policy";

export interface CreateSessionInput {
  userId: string;
  kind: SessionKind;
  twoFactorVerified: boolean;
  policy?: SessionPolicy;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CreatedSession {
  token: string;
  session: Session;
}

export async function createSession(input: CreateSessionInput): Promise<CreatedSession> {
  const token = generateToken(32);
  const policy = input.policy ?? SESSION_POLICIES[input.kind];
  const now = new Date();
  const [session] = await getDb()
    .insert(sessions)
    .values({
      id: sha256(token),
      userId: input.userId,
      kind: input.kind,
      twoFactorVerified: input.twoFactorVerified,
      createdAt: now,
      lastSeenAt: now,
      ...initialSessionTimes(policy, now),
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 500) ?? null,
    })
    .returning();
  return { token, session };
}

export interface ValidatedSession {
  session: Session;
  user: User;
}

/** Looks up a raw session token, enforces expiry and extends sliding sessions. */
export async function validateSessionToken(
  token: string,
  kind: SessionKind,
): Promise<ValidatedSession | null> {
  if (!token || token.length > 128) return null;
  const db = getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha256(token)), eq(sessions.kind, kind)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const now = new Date();
  if (!isSessionActive(row.session, now) || !row.user.isActive || row.user.deletedAt) {
    return null;
  }

  // Pending two factor sessions are short lived and never extended.
  if (row.session.twoFactorVerified) {
    const nextExpiry = nextSessionExpiry(row.session, SESSION_POLICIES[kind], now);
    if (nextExpiry) {
      await db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt: nextExpiry })
        .where(eq(sessions.id, row.session.id));
      row.session.lastSeenAt = now;
      row.session.expiresAt = nextExpiry;
    }
  }
  return row;
}

export async function revokeSessionById(sessionId: string): Promise<void> {
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function revokeSessionToken(token: string): Promise<void> {
  await revokeSessionById(sha256(token));
}

/** Revokes every session of a user, optionally keeping the current one. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string): Promise<void> {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await getDb()
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}
