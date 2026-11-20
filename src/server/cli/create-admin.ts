import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { backupCodes, users } from "../db/schema";
import { PASSWORD_ISSUE_MESSAGES, checkPasswordPolicy, hashPassword } from "../auth/password";
import { revokeUserSessions } from "../auth/session-store";
import { normalizeEmail } from "../services/auth";
import { writeAudit } from "../services/audit";
import { ask, confirm } from "./prompt";

/**
 * Creates the super_admin account, or resets its password (and optionally its
 * two factor setup) when it already exists. Passwords are only ever typed in
 * the terminal, never passed as arguments or environment variables.
 */
export async function createAdmin(args: string[]): Promise<number> {
  const flag = (name: string) => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const resetTwoFactor = args.includes("--reset-2fa");

  const email = normalizeEmail(flag("email") ?? (await ask("E-mail de l'administrateur", { defaultValue: process.env.ADMIN_EMAIL })));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("E-mail invalide.");
    return 1;
  }

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing && !(await confirm(`Le compte ${email} existe. Réinitialiser son mot de passe ?`))) {
    console.log("Aucune modification.");
    return 0;
  }

  const name = existing?.name ?? (flag("name") || (await ask("Nom affiché", { defaultValue: "Isaac Akonkwa" })));

  const password = await ask("Mot de passe (12 caractères minimum)", { hidden: true });
  const issues = checkPasswordPolicy(password, { email, name });
  if (issues.length > 0) {
    for (const issue of issues) console.error(`- ${PASSWORD_ISSUE_MESSAGES[issue]}`);
    return 1;
  }
  const again = await ask("Confirmez le mot de passe", { hidden: true });
  if (again !== password) {
    console.error("Les mots de passe ne correspondent pas.");
    return 1;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: now,
        failedLoginCount: 0,
        lockoutLevel: 0,
        lockedUntil: null,
        isActive: true,
        ...(resetTwoFactor ? { totpSecretEnc: null, totpEnabledAt: null, totpLastUsedStep: null } : {}),
      })
      .where(eq(users.id, existing.id));
    if (resetTwoFactor) await db.delete(backupCodes).where(eq(backupCodes.userId, existing.id));
    await revokeUserSessions(existing.id);
    await writeAudit({
      actorId: existing.id,
      action: "cli.admin_password_reset",
      entityType: "user",
      entityId: existing.id,
      diff: { resetTwoFactor },
    });
    console.log(`Mot de passe réinitialisé, sessions révoquées${resetTwoFactor ? ", 2FA réinitialisée" : ""}.`);
    return 0;
  }

  const [created] = await db
    .insert(users)
    .values({ email, name, role: "super_admin", passwordHash, passwordChangedAt: now, emailVerifiedAt: now })
    .returning({ id: users.id });
  await writeAudit({ actorId: created.id, action: "cli.admin_created", entityType: "user", entityId: created.id });
  console.log(`Compte super_admin créé pour ${email}. La 2FA sera configurée à la première connexion.`);
  return 0;
}
