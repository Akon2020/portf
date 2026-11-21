import { createElement } from "react";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AdminNotificationEmail, MagicLinkEmail } from "@/emails/templates";
import { getSiteUrl } from "@/lib/site";
import { requireClient } from "../auth/guards";
import { RATE_LIMITS, consumeRateLimit } from "../auth/rate-limit";
import { createSession } from "../auth/session-store";
import { consumeAuthToken, issueAuthToken } from "../auth/tokens";
import { readSettingUncached } from "../content/settings-store";
import { getDb } from "../db";
import { clientProjects, clients, contacts, conversations, invoices, loginAttempts, messages, milestones, payments, quotes, receipts, users } from "../db/schema";
import { renderMail, sendMailOrQueue } from "../mail/send";
import { writeAudit } from "./audit";
import { projectProgress } from "./clients";
import { upsertContact, type RequestMeta } from "./inbox";
import { notifyAdmins } from "./notifications";

/** Generic answer, identical whether the account exists or not. */
export const MAGIC_LINK_SENT = "Si un espace client existe pour cette adresse, un lien de connexion valable 15 minutes vient d'être envoyé.";

/**
 * Sends a single use sign-in link, only to clients whose portal is enabled.
 * Limited per IP and per e-mail. The caller always shows the same message.
 */
export async function requestMagicLink(rawEmail: string, meta: RequestMeta): Promise<void> {
  const email = rawEmail.trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  const [byIp, byEmail] = await Promise.all([
    consumeRateLimit(`magic:ip:${meta.ip}`, { limit: 10, windowSeconds: 3600 }),
    consumeRateLimit(`magic:email:${email}`, RATE_LIMITS.magicLink),
  ]);
  if (!byIp.allowed || !byEmail.allowed) {
    const { recordAppSignal } = await import("@/monitoring/record");
    await recordAppSignal({ ip: meta.ip, method: "POST", path: "/espace-client/connexion", query: "", userAgent: meta.userAgent }, { ruleId: "portal.magic-link-flood", category: "rate_abuse", severity: "medium", score: 15, excerpt: email });
    return;
  }

  const [row] = await getDb()
    .select({ user: users, client: clients })
    .from(users)
    .innerJoin(clients, eq(clients.id, users.clientId))
    .where(and(eq(users.email, email), eq(users.role, "client"), eq(users.isActive, true), isNull(users.deletedAt), eq(clients.portalEnabled, true), isNull(clients.deletedAt)))
    .limit(1);
  await getDb().insert(loginAttempts).values({ email, ip: meta.ip, success: Boolean(row), reason: row ? "magic_link_sent" : "magic_link_unknown" });
  if (!row) return;

  const token = await issueAuthToken({ type: "magic_link", email, userId: row.user.id, requestIp: meta.ip });
  const url = new URL(`/espace-client/verifier?jeton=${token}`, getSiteUrl()).toString();
  const mail = await renderMail(createElement(MagicLinkEmail, { name: row.client.contactName ?? row.client.name, url, locale: "fr" }));
  await sendMailOrQueue({ to: email, subject: "Votre lien de connexion à l'espace client", ...mail });
}

/** Consumes the link (POST only) and opens a client session. */
export async function confirmMagicLink(token: string, meta: RequestMeta): Promise<string | null> {
  const row = await consumeAuthToken(token, "magic_link");
  if (!row?.userId) return null;
  const [user] = await getDb()
    .select({ user: users, portalEnabled: clients.portalEnabled })
    .from(users)
    .innerJoin(clients, eq(clients.id, users.clientId))
    .where(and(eq(users.id, row.userId), eq(users.role, "client"), eq(users.isActive, true), isNull(clients.deletedAt)))
    .limit(1);
  if (!user?.portalEnabled) return null;
  const session = await createSession({ userId: user.user.id, kind: "client", twoFactorVerified: true, ip: meta.ip, userAgent: meta.userAgent });
  await getDb().update(users).set({ lastLoginAt: new Date(), lastLoginIp: meta.ip, emailVerifiedAt: user.user.emailVerifiedAt ?? new Date() }).where(eq(users.id, user.user.id));
  await writeAudit({ actorId: user.user.id, action: "portal.login", entityType: "client", entityId: user.user.clientId!, ...meta });
  return session.token;
}

/**
 * Guard of every portal page: valid client session and portal still enabled.
 * Every query below is then filtered on this client id.
 */
export async function requirePortal() {
  const session = await requireClient();
  const [client] = await getDb()
    .select()
    .from(clients)
    .where(and(eq(clients.id, session.clientId), eq(clients.portalEnabled, true), isNull(clients.deletedAt)))
    .limit(1);
  if (!client) redirect("/espace-client/connexion?ferme=1");
  return { ...session, client };
}

export async function portalOverview(clientId: string) {
  const db = getDb();
  const [projectRows, quoteRows, invoiceRows, receiptRows] = await Promise.all([
    db.select().from(clientProjects).where(and(eq(clientProjects.clientId, clientId), eq(clientProjects.visibleToClient, true), isNull(clientProjects.deletedAt))).orderBy(desc(clientProjects.createdAt)),
    db.select().from(quotes).where(and(eq(quotes.clientId, clientId), ne(quotes.status, "draft"), isNull(quotes.deletedAt), isNull(quotes.tokenRevokedAt))).orderBy(desc(quotes.issueDate)),
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.clientId, clientId), inArray(invoices.status, ["sent", "viewed", "partially_paid", "paid", "overdue"]), isNull(invoices.deletedAt), isNull(invoices.tokenRevokedAt)))
      .orderBy(desc(invoices.issueDate)),
    db
      .select({ receipt: receipts, payment: payments, invoiceNumber: invoices.number })
      .from(receipts)
      .innerJoin(payments, eq(payments.id, receipts.paymentId))
      .innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
      .where(and(eq(invoices.clientId, clientId), isNull(receipts.tokenRevokedAt)))
      .orderBy(desc(payments.paidAt)),
  ]);
  const projectIds = projectRows.map((project) => project.id);
  const milestoneRows = projectIds.length
    ? await db.select({ clientProjectId: milestones.clientProjectId, status: milestones.status }).from(milestones).where(inArray(milestones.clientProjectId, projectIds))
    : [];
  const due = new Map<"USD" | "CDF", number>();
  for (const invoice of invoiceRows) {
    if (invoice.status !== "paid") due.set(invoice.currency, (due.get(invoice.currency) ?? 0) + invoice.balance);
  }
  return {
    projects: projectRows.map((project) => ({ project, progress: projectProgress(project, milestoneRows.filter((row) => row.clientProjectId === project.id)) })),
    quotes: quoteRows,
    invoices: invoiceRows,
    receipts: receiptRows,
    due: [...due.entries()].filter(([, amount]) => amount > 0).map(([currency, amount]) => ({ currency, amount })),
  };
}

/** Message from the portal: lands in Isaac's inbox, in one conversation per project. */
export async function sendPortalMessage(clientId: string, projectId: string | null, body: string, meta: RequestMeta): Promise<{ ok: boolean; error?: string }> {
  const text = body.trim().slice(0, 5000);
  if (text.length < 5) return { ok: false, error: "Le message est trop court." };
  const limit = await consumeRateLimit(`portal:message:${clientId}`, { limit: 10, windowSeconds: 3600 });
  if (!limit.allowed) return { ok: false, error: "Trop de messages envoyés. Réessayez dans une heure." };
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client?.email) return { ok: false, error: "Votre fiche ne contient pas d'adresse e-mail." };
  let projectName: string | null = null;
  if (projectId) {
    const [project] = await db
      .select({ name: clientProjects.name })
      .from(clientProjects)
      .where(and(eq(clientProjects.id, projectId), eq(clientProjects.clientId, clientId), eq(clientProjects.visibleToClient, true)))
      .limit(1);
    if (!project) return { ok: false, error: "Projet introuvable." };
    projectName = project.name;
  }
  const contact = await upsertContact({ name: client.contactName ?? client.name, email: client.email, phone: client.whatsapp ?? client.phone, company: client.type === "company" ? client.name : null, locale: "fr" });
  if (!contact.clientId) await db.update(contacts).set({ clientId }).where(eq(contacts.id, contact.id));
  const subject = projectName ? `Espace client : ${projectName}` : "Espace client : message";
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.contactId, contact.id), eq(conversations.subject, subject), ne(conversations.status, "spam")))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  const conversation =
    existing ??
    (await db.insert(conversations).values({ contactId: contact.id, subject, topic: "project", source: "manual" }).returning())[0];
  await db.insert(messages).values({ conversationId: conversation.id, direction: "inbound", bodyText: text, ip: meta.ip, userAgent: meta.userAgent });
  await db.update(conversations).set({ status: "new", lastMessageAt: new Date() }).where(eq(conversations.id, conversation.id));

  const to = process.env.ADMIN_EMAIL || (await readSettingUncached("contact")).email;
  const mail = await renderMail(
    createElement(AdminNotificationEmail, {
      title: "Nouveau message depuis l'espace client",
      fields: [["Client", client.name], ...(projectName ? ([["Projet", projectName]] as [string, string][]) : [])],
      body: text,
      url: new URL(`/admin/messagerie/${conversation.id}`, getSiteUrl()).toString(),
    }),
  );
  await sendMailOrQueue({ to, subject: `[Espace client] ${subject}`, replyTo: client.email, ...mail });
  await notifyAdmins({ type: "portal_message", title: `Message de ${client.name}`, body: text.slice(0, 200), url: `/admin/messagerie/${conversation.id}` });
  return { ok: true };
}
