import { createElement } from "react";
import { eq } from "drizzle-orm";
import { SecurityEmail } from "@/emails/templates";
import { getSiteUrl } from "@/lib/site";
import { issueAuthToken } from "../auth/tokens";
import { getDb } from "../db";
import { messages, users } from "../db/schema";
import { mailFrom, sendMail } from "../mail/send";
import { getMailTransport } from "../mail/transport";
import { registerJobHandler } from "./runner";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

async function userEmail(userId: unknown): Promise<{ id: string; email: string } | null> {
  if (typeof userId !== "string") return null;
  const [user] = await getDb().select({ id: users.id, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

let registered = false;

/** Registers every job handler. Called by the cron entry point and the web process. */
export function registerJobHandlers(): void {
  if (registered) return;
  registered = true;

  registerJobHandler("security.alert", async (payload) => {
    const { sendSecurityDigest } = await import("@/monitoring/alerts");
    await sendSecurityDigest(typeof payload.since === "string" ? new Date(payload.since) : new Date(Date.now() - 15 * 60_000));
  });

  registerJobHandler("monitoring.batela", async (payload) => {
    const endpoint = process.env.BATELA_ENDPOINT;
    const key = process.env.BATELA_API_KEY;
    if (!endpoint || !key || !Array.isArray(payload.events)) return;
    const { postBatch } = await import("@/monitoring/transport");
    await postBatch(endpoint, key, payload.events as never);
  });

  registerJobHandler("task.reminder", async (payload) => {
    if (typeof payload.reminderId !== "string") return;
    const { deliverReminder } = await import("../services/tasks");
    await deliverReminder(payload.reminderId);
  });

  // Retry of an e-mail that could not be sent at request time.
  registerJobHandler("mail.raw", async (payload) => {
    const mail = payload as {
      to: string;
      subject: string;
      html: string;
      text: string;
      replyTo?: string;
      inReplyTo?: string | null;
      references?: string[];
      messageId: string;
    };
    await getMailTransport().send({
      from: mailFrom(),
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      messageId: mail.messageId,
      inReplyTo: mail.inReplyTo ?? undefined,
      references: mail.references?.length ? mail.references.join(" ") : undefined,
    });
    await getDb()
      .update(messages)
      .set({ deliveryStatus: "sent", deliveryError: null })
      .where(eq(messages.emailMessageId, mail.messageId));
  });

  registerJobHandler("mail.security_alert", async (payload) => {
    const user = await userEmail(payload.userId);
    if (!user) return;
    await sendMail({
      to: user.email,
      subject: "Alerte : compte administrateur verrouillé",
      react: createElement(SecurityEmail, {
        title: "Plusieurs échecs de connexion",
        lines: [
          `Votre compte a été verrouillé pendant ${payload.minutes} minutes après plusieurs mots de passe incorrects.`,
          `Dernière adresse IP : ${payload.ip ?? "inconnue"}.`,
          `Navigateur : ${payload.userAgent ?? "inconnu"}.`,
          "Si ce n'était pas vous, aucune action n'est nécessaire : la double authentification protège toujours le compte. Pensez toutefois à changer votre mot de passe.",
        ],
      }),
    });
  });

  registerJobHandler("mail.new_login", async (payload) => {
    const user = await userEmail(payload.userId);
    if (!user) return;
    const token = await issueAuthToken({ type: "session_revoke", email: user.email, userId: user.id });
    const url = new URL(`/auth/revoquer?jeton=${token}`, getSiteUrl()).toString();
    await sendMail({
      to: user.email,
      subject: "Nouvelle connexion à l'administration",
      react: createElement(SecurityEmail, {
        title: "Connexion depuis une nouvelle adresse",
        lines: [
          `Une connexion réussie a eu lieu le ${dateTime.format(new Date())}.`,
          `Adresse IP : ${payload.ip ?? "inconnue"}.`,
          `Navigateur : ${payload.userAgent ?? "inconnu"}.`,
          "Si c'était vous, ignorez ce message. Sinon, révoquez immédiatement toutes les sessions puis changez votre mot de passe.",
        ],
        url,
        cta: "Ce n'était pas moi",
      }),
    });
  });
}
