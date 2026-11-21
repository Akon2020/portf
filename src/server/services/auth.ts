import { and, count, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { backupCodes, loginAttempts, trustedIps, users, type User } from "../db/schema";
import { decryptSecret, encryptSecret, sha256 } from "../auth/crypto";
import {
  PASSWORD_ISSUE_MESSAGES,
  checkPasswordPolicy,
  hashPassword,
  needsRehash,
  verifyDummyPassword,
  verifyPassword,
} from "../auth/password";
import { SESSION_POLICIES, computeLockout } from "../auth/policy";
import { RATE_LIMITS, consumeRateLimit, resetRateLimit } from "../auth/rate-limit";
import {
  createSession,
  revokeSessionById,
  revokeUserSessions,
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
  | { ok: true; token: string; next: "verify" | "done" }
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
    const { recordAppSignal } = await import("@/monitoring/record");
    await recordAppSignal(
      { ip: meta.ip, method: "POST", path: "/auth/login", query: "", userAgent: meta.userAgent },
      lockout
        ? { ruleId: "auth.lockout", category: "brute_force", severity: "high", score: 30, excerpt: email }
        : { ruleId: "auth.failed-login", category: "brute_force", severity: "low", score: 5, excerpt: email },
    );
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

  // Two factor authentication is optional: without it the session is complete.
  if (!user.totpEnabledAt) {
    const token = await completeLogin(user, meta, "auth.login");
    return { ok: true, token, next: "done" };
  }
  const { token } = await createSession({
    userId: user.id,
    kind: "admin",
    twoFactorVerified: false,
    policy: SESSION_POLICIES.pending_2fa,
    ...meta,
  });
  return { ok: true, token, next: "verify" };
}

/** Opens the full admin session and records the login. */
async function completeLogin(user: User, meta: RequestMeta, action: string, pendingSessionId?: string): Promise<string> {
  if (pendingSessionId) await revokeSessionById(pendingSessionId);
  const { token } = await createSession({ userId: user.id, kind: "admin", twoFactorVerified: true, ...meta });
  await getDb()
    .update(users)
    .set({ lastLoginAt: new Date(), lastLoginIp: meta.ip, lockoutLevel: 0 })
    .where(eq(users.id, user.id));
  await resetRateLimit(`login:email:${sha256(user.email)}`);
  await noteLoginIp(user, meta);
  await writeAudit({ actorId: user.id, action, entityType: "user", entityId: user.id, ...meta });
  return token;
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

async function upgradeSession(pending: ValidatedSession, meta: RequestMeta, action: string): Promise<string> {
  return completeLogin(pending.user, meta, action, pending.session.id);
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

// Account security, for a logged in administrator

async function loadUser(userId: string): Promise<User> {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Utilisateur introuvable.");
  return user;
}

/** Starts (or resumes) TOTP enrollment: the secret is stored encrypted, not yet enabled. */
export async function beginTotpEnrollment(userId: string) {
  const user = await loadUser(userId);
  if (user.totpEnabledAt) return null;
  let secret: string;
  if (user.totpSecretEnc) {
    secret = decryptSecret(user.totpSecretEnc, encryptionKey());
  } else {
    secret = generateTotpSecret();
    await getDb().update(users).set({ totpSecretEnc: encryptSecret(secret, encryptionKey()) }).where(eq(users.id, userId));
  }
  return { secret, uri: totpUri(secret, user.email), qrDataUrl: await totpQrDataUrl(secret, user.email) };
}

export type SecurityResult = { ok: true; backupCodes?: string[] } | { ok: false; error: string };

async function storeBackupCodes(userId: string): Promise<string[]> {
  const codes = generateBackupCodes();
  await getDb().transaction(async (tx) => {
    await tx.delete(backupCodes).where(eq(backupCodes.userId, userId));
    await tx.insert(backupCodes).values(codes.map((code) => ({ userId, codeHash: hashBackupCode(code) })));
  });
  return codes;
}

export async function confirmTotpEnrollment(userId: string, code: string, meta: RequestMeta): Promise<SecurityResult> {
  const user = await loadUser(userId);
  if (user.totpEnabledAt) return { ok: false, error: "La double authentification est déjà active." };
  if (!user.totpSecretEnc) return { ok: false, error: "Relancez la configuration." };
  const limit = await consumeRateLimit(`totp:enroll:${userId}`, RATE_LIMITS.totp);
  if (!limit.allowed) return { ok: false, error: "Trop d'essais. Réessayez dans quelques minutes." };
  const step = verifyTotpCode(decryptSecret(user.totpSecretEnc, encryptionKey()), code, user.totpLastUsedStep);
  if (step === null) return { ok: false, error: "Code invalide. Vérifiez l'heure de votre téléphone." };
  await getDb().update(users).set({ totpEnabledAt: new Date(), totpLastUsedStep: step }).where(eq(users.id, userId));
  const codes = await storeBackupCodes(userId);
  await writeAudit({ actorId: userId, action: "auth.totp_enabled", entityType: "user", entityId: userId, ...meta });
  return { ok: true, backupCodes: codes };
}

/** Checks the current password, plus a TOTP or backup code when 2FA is on. */
async function verifyIdentity(user: User, password: string, code: string): Promise<string | null> {
  const limit = await consumeRateLimit(`reauth:${user.id}`, RATE_LIMITS.login);
  if (!limit.allowed) return "Trop d'essais. Réessayez plus tard.";
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) return "Mot de passe incorrect.";
  if (user.totpEnabledAt && user.totpSecretEnc) {
    if (looksLikeBackupCode(code)) {
      const [used] = await getDb()
        .update(backupCodes)
        .set({ usedAt: new Date() })
        .where(and(eq(backupCodes.userId, user.id), eq(backupCodes.codeHash, hashBackupCode(code)), isNull(backupCodes.usedAt)))
        .returning({ id: backupCodes.id });
      if (!used) return "Code invalide.";
    } else {
      const step = verifyTotpCode(decryptSecret(user.totpSecretEnc, encryptionKey()), code, user.totpLastUsedStep);
      if (step === null) return "Code invalide.";
      await getDb().update(users).set({ totpLastUsedStep: step }).where(eq(users.id, user.id));
    }
  }
  return null;
}

export async function disableTotp(userId: string, password: string, code: string, meta: RequestMeta): Promise<SecurityResult> {
  const user = await loadUser(userId);
  if (!user.totpEnabledAt) return { ok: false, error: "La double authentification n'est pas active." };
  const error = await verifyIdentity(user, password, code);
  if (error) return { ok: false, error };
  await getDb().update(users).set({ totpEnabledAt: null, totpSecretEnc: null, totpLastUsedStep: null }).where(eq(users.id, userId));
  await getDb().delete(backupCodes).where(eq(backupCodes.userId, userId));
  await writeAudit({ actorId: userId, action: "auth.totp_disabled", entityType: "user", entityId: userId, ...meta });
  return { ok: true };
}

export async function regenerateBackupCodes(userId: string, password: string, code: string, meta: RequestMeta): Promise<SecurityResult> {
  const user = await loadUser(userId);
  if (!user.totpEnabledAt) return { ok: false, error: "Activez d'abord la double authentification." };
  const error = await verifyIdentity(user, password, code);
  if (error) return { ok: false, error };
  const codes = await storeBackupCodes(userId);
  await writeAudit({ actorId: userId, action: "auth.backup_codes_regenerated", entityType: "user", entityId: userId, ...meta });
  return { ok: true, backupCodes: codes };
}

/** Changes the password and closes every other session. */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { current: string; next: string; confirmation: string; code: string },
  meta: RequestMeta,
): Promise<SecurityResult> {
  const user = await loadUser(userId);
  if (input.next !== input.confirmation) return { ok: false, error: "Les nouveaux mots de passe ne correspondent pas." };
  const issues = checkPasswordPolicy(input.next, { email: user.email, name: user.name });
  if (issues.length > 0) return { ok: false, error: issues.map((issue) => PASSWORD_ISSUE_MESSAGES[issue]).join(" ") };
  const error = await verifyIdentity(user, input.current, input.code);
  if (error) return { ok: false, error };
  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(input.next), passwordChangedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeUserSessions(userId, currentSessionId);
  await writeAudit({ actorId: userId, action: "auth.password_changed", entityType: "user", entityId: userId, ...meta });
  return { ok: true };
}

export async function revokeOtherSessions(userId: string, currentSessionId: string, meta: RequestMeta): Promise<void> {
  await revokeUserSessions(userId, currentSessionId);
  await writeAudit({ actorId: userId, action: "auth.sessions_revoked", entityType: "user", entityId: userId, ...meta });
}


export async function logout(sessionId: string, userId: string, meta: RequestMeta): Promise<void> {
  await revokeSessionById(sessionId);
  await writeAudit({ actorId: userId, action: "auth.logout", entityType: "user", entityId: userId, ...meta });
}
