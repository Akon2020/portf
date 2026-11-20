import { createElement } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { SecurityEmail } from "@/emails/templates";
import { getSiteUrl } from "@/lib/site";
import { checkPasswordPolicy, hashPassword, PASSWORD_ISSUE_MESSAGES } from "../auth/password";
import { RATE_LIMITS, consumeRateLimit } from "../auth/rate-limit";
import { revokeUserSessions } from "../auth/session-store";
import { consumeAuthToken, issueAuthToken, peekAuthToken } from "../auth/tokens";
import { sha256 } from "../auth/crypto";
import { getDb } from "../db";
import { users } from "../db/schema";
import { sendMail } from "../mail/send";
import { writeAudit } from "./audit";
import { ADMIN_ROLES, normalizeEmail, type RequestMeta } from "./auth";

/**
 * Sends a reset link when an admin account exists. The caller always shows
 * the same message, whatever happens, so accounts cannot be enumerated.
 */
export async function requestPasswordReset(rawEmail: string, meta: RequestMeta): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`reset:ip:${meta.ip}`, RATE_LIMITS.passwordReset),
    consumeRateLimit(`reset:email:${sha256(email)}`, RATE_LIMITS.passwordReset),
  ]);
  if (!byIp.allowed || !byEmail.allowed) return;

  const [user] = await getDb()
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt), eq(users.isActive, true)))
    .limit(1);
  if (!user || !(ADMIN_ROLES as readonly string[]).includes(user.role)) return;

  const token = await issueAuthToken({ type: "password_reset", email, userId: user.id, requestIp: meta.ip });
  const url = new URL(`/auth/reinitialiser?jeton=${token}`, getSiteUrl()).toString();
  await sendMail({
    to: email,
    subject: "Réinitialisation du mot de passe",
    react: createElement(SecurityEmail, {
      title: "Réinitialiser votre mot de passe",
      lines: [
        "Une réinitialisation du mot de passe de l'administration a été demandée.",
        `Adresse IP de la demande : ${meta.ip}. Le lien est valable 30 minutes et ne fonctionne qu'une fois.`,
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      ],
      url,
      cta: "Choisir un nouveau mot de passe",
    }),
  });
  await writeAudit({ actorId: user.id, action: "auth.password_reset_requested", entityType: "user", entityId: user.id, ...meta });
}

export async function isResetTokenValid(token: string): Promise<boolean> {
  return !!(await peekAuthToken(token, "password_reset"));
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetPassword(token: string, password: string, confirmation: string, meta: RequestMeta): Promise<ResetResult> {
  if (password !== confirmation) return { ok: false, error: "Les mots de passe ne correspondent pas." };
  const pending = await peekAuthToken(token, "password_reset");
  if (!pending?.userId) return { ok: false, error: "Ce lien est invalide ou a expiré." };
  const [user] = await getDb().select().from(users).where(eq(users.id, pending.userId)).limit(1);
  if (!user) return { ok: false, error: "Ce lien est invalide ou a expiré." };

  const issues = checkPasswordPolicy(password, { email: user.email, name: user.name });
  if (issues.length > 0) return { ok: false, error: issues.map((issue) => PASSWORD_ISSUE_MESSAGES[issue]).join(" ") };

  const consumed = await consumeAuthToken(token, "password_reset");
  if (!consumed) return { ok: false, error: "Ce lien est invalide ou a expiré." };

  await getDb()
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockoutLevel: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, user.id));
  // Every session is revoked; the next login still requires the TOTP code.
  await revokeUserSessions(user.id);
  await writeAudit({ actorId: user.id, action: "auth.password_reset", entityType: "user", entityId: user.id, ...meta });
  return { ok: true };
}

/** "It was not me" link from the new login e-mail. */
export async function revokeSessionsWithToken(token: string, meta: RequestMeta): Promise<boolean> {
  const consumed = await consumeAuthToken(token, "session_revoke");
  if (!consumed?.userId) return false;
  await revokeUserSessions(consumed.userId);
  await writeAudit({ actorId: consumed.userId, action: "auth.sessions_revoked_by_email", entityType: "user", entityId: consumed.userId, ...meta });
  return true;
}
