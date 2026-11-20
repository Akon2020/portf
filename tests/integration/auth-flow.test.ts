import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { jobs, loginAttempts, users } from "@/server/db/schema";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { createSession, validateSessionToken } from "@/server/auth/session-store";
import { consumeAuthToken, issueAuthToken, peekAuthToken } from "@/server/auth/tokens";
import { currentTotpStep, generateTotpCode } from "@/server/auth/totp";
import {
  beginTotpEnrollment,
  changePassword,
  confirmTotpEnrollment,
  disableTotp,
  loginWithPassword,
  verifySecondFactor,
} from "@/server/services/auth";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";

const PASSWORD = "Lac Kivu au lever du jour 42";
const meta = { ip: "203.0.113.10", userAgent: "vitest" };

async function createAdmin(email = "admin@example.test") {
  const [user] = await getDb()
    .insert(users)
    .values({ email, name: "Admin Test", role: "super_admin", passwordHash: await hashPassword(PASSWORD) })
    .returning();
  return user;
}

/** Enables TOTP from the account page, returns the secret and the backup codes. */
async function enrolledAdmin() {
  const user = await createAdmin();
  const enrollment = await beginTotpEnrollment(user.id);
  const now = Date.now();
  const confirm = await confirmTotpEnrollment(user.id, generateTotpCode(enrollment!.secret, now), meta);
  if (!confirm.ok) throw new Error("enrollment failed");
  return { user, secret: enrollment!.secret, setupStep: currentTotpStep(now), confirm };
}

describe.skipIf(!hasTestDatabase)("admin authentication flow", () => {
  beforeEach(prepareTestDatabase);
  afterAll(closeDb);

  it("rejects unknown e-mails and wrong passwords with the same generic error", async () => {
    await createAdmin();
    const unknown = await loginWithPassword({ email: "nobody@example.test", password: PASSWORD }, meta);
    const wrong = await loginWithPassword({ email: "admin@example.test", password: "Mauvais mot de passe 1" }, meta);
    expect(unknown).toEqual({ ok: false, error: "invalid_credentials" });
    expect(wrong).toEqual({ ok: false, error: "invalid_credentials" });
    const attempts = await getDb().select().from(loginAttempts);
    expect(attempts.map((a) => a.reason).sort()).toEqual(["unknown_email", "wrong_password"]);
  });

  it("logs in directly with a normalized e-mail when two factor is off", async () => {
    await createAdmin();
    const result = await loginWithPassword({ email: "  ADMIN@Example.test ", password: PASSWORD }, meta);
    expect(result).toMatchObject({ ok: true, next: "done" });
    if (!result.ok) return;
    const session = await validateSessionToken(result.token, "admin");
    expect(session?.session.twoFactorVerified).toBe(true);
  });

  it("enables TOTP from the account and then requires the code at login", async () => {
    const { confirm, user } = await enrolledAdmin();
    if (!confirm.ok) return;
    expect(confirm.backupCodes).toHaveLength(10);
    const login = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    expect(login).toMatchObject({ ok: true, next: "verify" });
    if (!login.ok) return;
    const pending = await validateSessionToken(login.token, "admin");
    expect(pending?.session.twoFactorVerified).toBe(false);
    expect(pending!.session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(5 * 60_000);
  });

  it("disables TOTP only with the password and a valid code", async () => {
    const { user, secret, setupStep } = await enrolledAdmin();
    expect(await disableTotp(user.id, "Mauvais mot de passe", "000000", meta)).toMatchObject({ ok: false });
    expect(await disableTotp(user.id, PASSWORD, "000000", meta)).toMatchObject({ ok: false });
    const code = generateTotpCode(secret, (setupStep + 1) * 30_000 + 1_000);
    expect(await disableTotp(user.id, PASSWORD, code, meta)).toEqual({ ok: true });
    const login = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    expect(login).toMatchObject({ ok: true, next: "done" });
  });

  it("changes the password and closes the other sessions", async () => {
    const user = await createAdmin();
    const current = await createSession({ userId: user.id, kind: "admin", twoFactorVerified: true });
    const other = await createSession({ userId: user.id, kind: "admin", twoFactorVerified: true });
    const input = { current: PASSWORD, next: "Nouvelle phrase secrète 2027", confirmation: "Nouvelle phrase secrète 2027", code: "" };
    expect(await changePassword(user.id, current.session.id, { ...input, confirmation: "autre" }, meta)).toMatchObject({ ok: false });
    expect(await changePassword(user.id, current.session.id, input, meta)).toEqual({ ok: true });
    expect(await validateSessionToken(current.token, "admin")).not.toBeNull();
    expect(await validateSessionToken(other.token, "admin")).toBeNull();
    const [updated] = await getDb().select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(updated.passwordHash!, input.next)).toBe(true);
  });

  it("verifies TOTP at login and refuses a replayed code", async () => {
    const { user, secret, setupStep } = await enrolledAdmin();
    const nextStepTime = (setupStep + 1) * 30_000 + 1_000;
    const code = generateTotpCode(secret, nextStepTime);

    const first = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    expect(first).toMatchObject({ ok: true, next: "verify" });
    if (!first.ok) return;
    expect(await verifySecondFactor(first.token, "000000", meta)).toEqual({ ok: false, error: "invalid_code" });

    // The next time step is inside the validation window.
    const ok = await verifySecondFactor(first.token, code, meta);
    expect(ok.ok).toBe(true);

    const second = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    if (!second.ok) return;
    expect(await verifySecondFactor(second.token, code, meta)).toEqual({ ok: false, error: "invalid_code" });
  });

  it("accepts a backup code exactly once", async () => {
    const { user, confirm } = await enrolledAdmin();
    if (!confirm.ok) return;
    const backup = confirm.backupCodes![3];
    const a = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    if (!a.ok) return;
    expect(await verifySecondFactor(a.token, backup.toLowerCase(), meta)).toMatchObject({
      ok: true,
      usedBackupCode: true,
      remainingBackupCodes: 9,
    });
    const b = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
    if (!b.ok) return;
    expect(await verifySecondFactor(b.token, backup, meta)).toEqual({ ok: false, error: "invalid_code" });
  });

  it("locks the account after five wrong passwords and alerts", async () => {
    const user = await createAdmin();
    for (let i = 0; i < 5; i++) {
      await loginWithPassword({ email: user.email, password: `Mauvais essai numero ${i}` }, { ...meta, ip: `198.51.100.${i}` });
    }
    const [locked] = await getDb().select().from(users).where(eq(users.id, user.id));
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(locked.lockoutLevel).toBe(1);

    const blocked = await loginWithPassword({ email: user.email, password: PASSWORD }, { ...meta, ip: "198.51.100.99" });
    expect(blocked).toMatchObject({ ok: false, error: "too_many_attempts" });
    const queued = await getDb().select().from(jobs);
    expect(queued.map((j) => j.type)).toContain("mail.security_alert");
  });

  it("rate limits by IP across e-mails", async () => {
    for (let i = 0; i < 5; i++) {
      await loginWithPassword({ email: `x${i}@example.test`, password: "Nimporte quoi 123" }, meta);
    }
    const sixth = await loginWithPassword({ email: "y@example.test", password: "Nimporte quoi 123" }, meta);
    expect(sixth).toMatchObject({ ok: false, error: "too_many_attempts" });
  });

  it("counts rate limits atomically", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit("test:parallel", RATE_LIMITS.login)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("issues single use magic link tokens and invalidates older ones", async () => {
    const first = await issueAuthToken({ type: "magic_link", email: "Client@Example.test" });
    const second = await issueAuthToken({ type: "magic_link", email: "client@example.test" });
    expect(await peekAuthToken(first, "magic_link")).toBeNull();
    expect(await peekAuthToken(second, "magic_link")).not.toBeNull();
    expect(await consumeAuthToken(second, "magic_link")).not.toBeNull();
    expect(await consumeAuthToken(second, "magic_link")).toBeNull();
    expect(await consumeAuthToken(second, "password_reset")).toBeNull();
  });
});
