import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, validateSessionToken } from "@/server/auth/session-store";
import { closeDb, getDb } from "@/server/db";
import { users } from "@/server/db/schema";
import { registerJobHandlers } from "@/server/jobs/handlers";
import { runDueJobs } from "@/server/jobs/runner";
import { enqueueJob } from "@/server/jobs/queue";
import { requestPasswordReset, resetPassword, revokeSessionsWithToken } from "@/server/services/account-recovery";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, decodeEml, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.20", userAgent: "vitest" };

async function createAdmin() {
  const [user] = await getDb()
    .insert(users)
    .values({ email: "admin@example.test", name: "Admin", role: "super_admin", passwordHash: await hashPassword("Ancien mot de passe 2026") })
    .returning();
  return user;
}

function tokenFrom(eml: string, path: string): string {
  const match = decodeEml(eml).match(new RegExp(`${path}\\?jeton=([A-Za-z0-9_-]+)`));
  if (!match) throw new Error("token not found in e-mail");
  return match[1];
}

describe.skipIf(!hasTestDatabase)("account recovery", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("sends nothing for an unknown e-mail", async () => {
    await requestPasswordReset("nobody@example.test", meta);
    expect(await readOutbox()).toHaveLength(0);
  });

  it("resets the password once and revokes every session", async () => {
    const user = await createAdmin();
    const { token: sessionToken } = await createSession({ userId: user.id, kind: "admin", twoFactorVerified: true });
    await requestPasswordReset("ADMIN@example.test", meta);
    const [mail] = await readOutbox();
    expect(mail).toContain("Subject: =?UTF-8?Q?R=C3=A9initialisation");
    const token = tokenFrom(mail, "/admin/reinitialiser");

    expect(await resetPassword(token, "court", "court", meta)).toMatchObject({ ok: false });
    expect(await resetPassword(token, "Nouveau mot de passe 2027", "Autre chose 2027", meta)).toMatchObject({ ok: false });
    expect(await resetPassword(token, "Nouveau mot de passe 2027", "Nouveau mot de passe 2027", meta)).toEqual({ ok: true });
    expect(await resetPassword(token, "Encore un autre 2028", "Encore un autre 2028", meta)).toMatchObject({ ok: false });

    const [updated] = await getDb().select().from(users).where(eq(users.id, user.id));
    expect(await verifyPassword(updated.passwordHash!, "Nouveau mot de passe 2027")).toBe(true);
    expect(await validateSessionToken(sessionToken, "admin")).toBeNull();
  });

  it("revokes sessions from the new login e-mail link", async () => {
    registerJobHandlers();
    const user = await createAdmin();
    const { token: sessionToken } = await createSession({ userId: user.id, kind: "admin", twoFactorVerified: true });
    await enqueueJob("mail.new_login", { userId: user.id, ip: "198.51.100.7", userAgent: "Firefox" });
    const result = await runDueJobs({ budgetMs: 10_000 });
    expect(result.processed).toBeGreaterThanOrEqual(1);
    const [mail] = await readOutbox();
    const token = tokenFrom(mail, "/admin/securite/revoquer");
    expect(await revokeSessionsWithToken(token, meta)).toBe(true);
    expect(await revokeSessionsWithToken(token, meta)).toBe(false);
    expect(await validateSessionToken(sessionToken, "admin")).toBeNull();
  });
});
