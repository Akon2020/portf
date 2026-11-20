import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { backupCodes, loginAttempts, trustedIps, users, type User } from "../db/schema";
import { decryptSecret, encryptSecret, sha256 } from "../auth/crypto";
import { hashPassword, needsRehash, verifyDummyPassword, verifyPassword } from "../auth/password";
import { SESSION_POLICIES, computeLockout } from "../auth/policy";
import { RATE_LIMITS, consumeRateLimit, resetRateLimit } from "../auth/rate-limit";
import {
  createSession,
  revokeSessionById,
  validateSessionToken,
  type ValidatedSession,
} from "../auth/session-store";
import {
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  looksLikeBackupCode,
  totpQrDataUrl,
  totpUri,
  verifyTotpCode,
} from "../auth/totp";
import { getEnv } from "../env";
import { enqueueJob } from "../jobs/queue";
import { writeAudit } from "./audit";

export const ADMIN_ROLES = ["super_admin", "editor", "viewer"] as const;

export interface RequestMeta {
  ip: string;
  userAgent: string | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isAdminUser(user: User): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(user.role);
}

function encryptionKey(): string {
  return getEnv().AUTH_ENCRYPTION_KEY;
}

async function recordAttempt(email: string, meta: RequestMeta, success: boolean, reason: string) {
  await getDb()
    .insert(loginAttempts)
    .values({ email, ip: meta.ip, userAgent: meta.userAgent, success, reason });
}

// Step 1: password

export type LoginResult =
  | { ok: true; token: string; next: "verify" | "setup" }
  | { ok: false; error: "invalid_credentials" | "too_many_attempts"; retryAfterSeconds?: number };

export async function loginWithPassword(
  input: { email: string; password: string },
  meta: RequestMeta,
): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const db = getDb();

  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`login:ip:${meta.ip}`, RATE_LIMITS.login),
    consumeRateLimit(`login:email:${sha256(email)}`, RATE_LIMITS.login),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    await recordAttempt(email, meta, false, "rate_limited");
    return {
      ok: false,
      error: "too_many_attempts",
      retryAfterSeconds: Math.max(byIp.retryAfterSeconds, byEmail.retryAfterSeconds),
    };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);

  if (!user || !user.passwordHash || !user.isActive || !isAdminUser(user)) {
    await verifyDummyPassword(input.password);
    await recordAttempt(email, meta, false, user ? "not_allowed" : "unknown_email");
    return { ok: false, error: "invalid_credentials" };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyDummyPassword(input.password);
    await recordAttempt(email, meta, false, "locked");
    return {
      ok: false,
      error: "too_many_attempts",
      retryAfterSeconds: Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000),
    };
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    const failed = user.failedLoginCount + 1;
    const lockout = computeLockout(failed, user.lockoutLevel);
    await db
      .update(users)
      .set(lockout ? { failedLoginCount: 0, lockedUntil: lockout.lockedUntil, lockoutLevel: lockout.lockoutLevel } : { failedLoginCount: failed })
      .where(eq(users.id, user.id));
    await recordAttempt(email, meta, false, lockout ? "locked_now" : "wrong_password");
    if (lockout) {
      await enqueueJob("mail.security_alert", {
        kind: "account_locked",
        userId: user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        minutes: lockout.minutes,
      });
      await writeAudit({
        actorId: null,
        action: "auth.account_locked",
        entityType: "user",
        entityId: user.id,
        diff: { minutes: lockout.minutes, level: lockout.lockoutLevel },
        ...meta,
      });
    }
    return { ok: false, error: "invalid_credentials" };
  }

  const updates: Partial<typeof users.$inferInsert> = { failedLoginCount: 0, lockedUntil: null };
  if (needsRehash(user.passwordHash)) updates.passwordHash = await hashPassword(input.password);
  await db.update(users).set(updates).where(eq(users.id, user.id));
  await recordAttempt(email, meta, true, "password_ok");

  const setup = !user.totpEnabledAt;
  const { token } = await createSession({
    userId: user.id,
    kind: "admin",
    twoFactorVerified: false,
    policy: setup ? SESSION_POLICIES.pending_setup : SESSION_POLICIES.pending_2fa,
    ...meta,
  });
  return { ok: true, token, next: setup ? "setup" : "verify" };
}

// Step 2: second factor

export async function getPendingSession(token: string): Promise<ValidatedSession | null> {
  const result = await validateSessionToken(token, "admin");
  if (!result || result.session.twoFactorVerified || !isAdminUser(result.user)) return null;
  return result;
}

export type SecondFactorResult =
  | { ok: true; token: string; usedBackupCode: boolean; remainingBackupCodes: number }
  | { ok: false; error: "invalid_code" | "too_many_attempts" | "expired" };

async function upgradeSession(
  pending: ValidatedSession,
  meta: RequestMeta,
  action: string,
): Promise<string> {
  const db = getDb();
  await revokeSessionById(pending.session.id);
  const { token } = await createSession({
    userId: pending.user.id,
    kind: "admin",
    twoFactorVerified: true,
    ...meta,
  });
  await db
    .update(users)
    .set({ lastLoginAt: new Date(), lastLoginIp: meta.ip, lockoutLevel: 0 })
    .where(eq(users.id, pending.user.id));
  await resetRateLimit(`login:email:${sha256(pending.user.email)}`);
  await noteLoginIp(pending.user, meta);
  await writeAudit({ actorId: pending.user.id, action, entityType: "user", entityId: pending.user.id, ...meta });
  return token;
}

/** Records the IP and sends a notification when it was never seen before. */
async function noteLoginIp(user: User, meta: RequestMeta): Promise<void> {
  const db = getDb();
  const [{ total }] = await db
    .select({ total: count() })
    .from(trustedIps)
    .where(eq(trustedIps.userId, user.id));
  const inserted = await db
    .insert(trustedIps)
    .values({ userId: user.id, ip: meta.ip, userAgent: meta.userAgent })
    .onConflictDoUpdate({
      target: [trustedIps.userId, trustedIps.ip],
      set: { lastSeenAt: new Date(), userAgent: meta.userAgent },
    })
    .returning({ createdAt: trustedIps.createdAt, lastSeenAt: trustedIps.lastSeenAt });
  const isNew = inserted[0] && inserted[0].createdAt.getTime() === inserted[0].lastSeenAt.getTime();
  if (isNew && total > 0) {
    await enqueueJob("mail.new_login", { userId: user.id, ip: meta.ip, userAgent: meta.userAgent });
  }
}

export async function verifySecondFactor(
  pendingToken: string,
  code: string,
  meta: RequestMeta,
): Promise<SecondFactorResult> {
  const pending = await getPendingSession(pendingToken);
  if (!pending || !pending.user.totpEnabledAt || !pending.user.totpSecretEnc) {
    return { ok: false, error: "expired" };
  }
  const limit = await consumeRateLimit(`totp:session:${pending.session.id}`, RATE_LIMITS.totp);
  if (!limit.allowed) {
    await revokeSessionById(pending.session.id);
    await recordAttempt(pending.user.email, meta, false, "totp_rate_limited");
    return { ok: false, error: "too_many_attempts" };
  }

  const db = getDb();
  const user = pending.user;

  if (looksLikeBackupCode(code)) {
    const [used] = await db
      .update(backupCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(backupCodes.userId, user.id),
          eq(backupCodes.codeHash, hashBackupCode(code)),
          isNull(backupCodes.usedAt),
        ),
      )
      .returning({ id: backupCodes.id });
    if (!used) {
      await recordAttempt(user.email, meta, false, "backup_code_invalid");
      return { ok: false, error: "invalid_code" };
    }
    const [{ remaining }] = await db
      .select({ remaining: count() })
      .from(backupCodes)
      .where(and(eq(backupCodes.userId, user.id), isNull(backupCodes.usedAt)));
    await recordAttempt(user.email, meta, true, "backup_code_ok");
    const token = await upgradeSession(pending, meta, "auth.login_backup_code");
    return { ok: true, token, usedBackupCode: true, remainingBackupCodes: remaining };
  }

  const secret = decryptSecret(user.totpSecretEnc!, encryptionKey());
  const step = verifyTotpCode(secret, code, user.totpLastUsedStep);
  if (step === null) {
    await recordAttempt(user.email, meta, false, "totp_invalid");
    return { ok: false, error: "invalid_code" };
  }
  // Atomic anti replay: only one request can claim a given time step.
  const claimed = await db
    .update(users)
    .set({ totpLastUsedStep: step })
    .where(
      and(
        eq(users.id, user.id),
        sql`(${users.totpLastUsedStep} is null or ${users.totpLastUsedStep} < ${step})`,
      ),
    )
    .returning({ id: users.id });
  if (claimed.length === 0) {
    await recordAttempt(user.email, meta, false, "totp_replay");
    return { ok: false, error: "invalid_code" };
  }
  await recordAttempt(user.email, meta, true, "totp_ok");
  const token = await upgradeSession(pending, meta, "auth.login");
  return { ok: true, token, usedBackupCode: false, remainingBackupCodes: -1 };
}

// First time TOTP setup

export async function startTotpSetup(pendingToken: string) {
  const pending = await getPendingSession(pendingToken);
  if (!pending || pending.user.totpEnabledAt) return null;
  let secret: string;
  if (pending.user.totpSecretEnc) {
    secret = decryptSecret(pending.user.totpSecretEnc, encryptionKey());
  } else {
    secret = generateTotpSecret();
    await getDb()
      .update(users)
      .set({ totpSecretEnc: encryptSecret(secret, encryptionKey()) })
      .where(eq(users.id, pending.user.id));
  }
  return {
    email: pending.user.email,
    secret,
    uri: totpUri(secret, pending.user.email),
    qrDataUrl: await totpQrDataUrl(secret, pending.user.email),
  };
}

export type ConfirmSetupResult =
  | { ok: true; token: string; backupCodes: string[] }
  | { ok: false; error: "invalid_code" | "too_many_attempts" | "expired" };

export async function confirmTotpSetup(
  pendingToken: string,
  code: string,
  meta: RequestMeta,
): Promise<ConfirmSetupResult> {
  const pending = await getPendingSession(pendingToken);
  if (!pending || pending.user.totpEnabledAt || !pending.user.totpSecretEnc) {
    return { ok: false, error: "expired" };
  }
  const limit = await consumeRateLimit(`totp:session:${pending.session.id}`, RATE_LIMITS.totp);
  if (!limit.allowed) {
    await revokeSessionById(pending.session.id);
    return { ok: false, error: "too_many_attempts" };
  }
  const secret = decryptSecret(pending.user.totpSecretEnc, encryptionKey());
  const step = verifyTotpCode(secret, code, pending.user.totpLastUsedStep);
  if (step === null) {
    await recordAttempt(pending.user.email, meta, false, "totp_setup_invalid");
    return { ok: false, error: "invalid_code" };
  }

  const codes = generateBackupCodes();
  await getDb().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ totpEnabledAt: new Date(), totpLastUsedStep: step })
      .where(eq(users.id, pending.user.id));
    await tx.delete(backupCodes).where(eq(backupCodes.userId, pending.user.id));
    await tx
      .insert(backupCodes)
      .values(codes.map((c) => ({ userId: pending.user.id, codeHash: hashBackupCode(c) })));
  });
  await recordAttempt(pending.user.email, meta, true, "totp_setup_ok");
  const token = await upgradeSession(pending, meta, "auth.totp_enabled");
  return { ok: true, token, backupCodes: codes };
}

export async function logout(sessionId: string, userId: string, meta: RequestMeta): Promise<void> {
  await revokeSessionById(sessionId);
  await writeAudit({ actorId: userId, action: "auth.logout", entityType: "user", entityId: userId, ...meta });
}
