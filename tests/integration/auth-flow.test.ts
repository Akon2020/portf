import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { jobs, loginAttempts, sessions, users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { validateSessionToken } from "@/server/auth/session-store";
import { consumeAuthToken, issueAuthToken, peekAuthToken } from "@/server/auth/tokens";
import { currentTotpStep, generateTotpCode } from "@/server/auth/totp";
import {
  confirmTotpSetup,
  loginWithPassword,
  startTotpSetup,
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

/** Logs in and enables TOTP, returns the secret and the full session token. */
async function enrolledAdmin() {
  const user = await createAdmin();
  const login = await loginWithPassword({ email: user.email, password: PASSWORD }, meta);
  if (!login.ok) throw new Error("login failed");
  const setup = await startTotpSetup(login.token);
  const now = Date.now();
  const confirm = await confirmTotpSetup(login.token, generateTotpCode(setup!.secret, now), meta);
  if (!confirm.ok) throw new Error("setup failed");
  return { user, secret: setup!.secret, setupStep: currentTotpStep(now), confirm };
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

  it("normalizes the e-mail and requires TOTP setup on first login", async () => {
    await createAdmin();
    const result = await loginWithPassword({ email: "  ADMIN@Example.test ", password: PASSWORD }, meta);
    expect(result).toMatchObject({ ok: true, next: "setup" });
    if (!result.ok) return;
    const pending = await validateSessionToken(result.token, "admin");
    expect(pending?.session.twoFactorVerified).toBe(false);
    expect(pending!.session.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(15 * 60_000);
  });

  it("enables TOTP, issues backup codes and rotates the session", async () => {
    const { confirm, user } = await enrolledAdmin();
    if (!confirm.ok) return;
    expect(confirm.backupCodes).toHaveLength(10);
    const full = await validateSessionToken(confirm.token, "admin");
    expect(full?.session.twoFactorVerified).toBe(true);
    const all = await getDb().select().from(sessions).where(eq(sessions.userId, user.id));
    expect(all.filter((s) => !s.revokedAt)).toHaveLength(1);
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
    const backup = confirm.backupCodes[3];
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
