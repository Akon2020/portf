import { createElement } from "react";
import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { AdminNotificationEmail, ContactAckEmail, ReplyEmail } from "@/emails/templates";
import { getSiteUrl } from "@/lib/site";
import { textToHtml } from "@/lib/text-html";
import { cleanTypography } from "@/lib/typography";
import { getDb } from "../db";
import { clients, contacts, conversations, messages, type Attachment, type Conversation } from "../db/schema";
import { readSettingUncached } from "../content/settings-store";
import { newMessageId, renderMail, sendMailOrQueue } from "../mail/send";
import { writeAudit } from "./audit";
import { notifyAdmins } from "./notifications";

export type Locale = "fr" | "en";

export const TOPICS = ["project", "collaboration", "recruitment", "mentoring", "other"] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_LABELS: Record<Locale, Record<Topic, string>> = {
  fr: { project: "Projet", collaboration: "Collaboration", recruitment: "Recrutement", mentoring: "Mentorat", other: "Autre" },
  en: { project: "Project", collaboration: "Collaboration", recruitment: "Hiring", mentoring: "Mentoring", other: "Other" },
};

const ACK_SUBJECT: Record<Locale, string> = {
  fr: "Votre message à Isaac Akonkwa",
  en: "Your message to Isaac Akonkwa",
};

export interface InboundInput {
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  topic: Topic;
  message: string;
  locale: Locale;
  source?: "contact_form" | "quote_form";
  attachments?: Attachment[];
  subject?: string;
}

export interface RequestMeta {
  ip: string;
  userAgent: string | null;
}

async function adminRecipient(): Promise<string> {
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  return (await readSettingUncached("contact")).email;
}

/** Finds or creates the contact for an e-mail address, updating details given again. */
export async function upsertContact(input: { name: string; email: string; phone?: string | null; company?: string | null; locale: Locale }) {
  const email = input.email.trim().toLowerCase();
  const [contact] = await getDb()
    .insert(contacts)
    .values({ name: input.name, email, phone: input.phone ?? null, company: input.company ?? null, locale: input.locale })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        name: input.name,
        locale: input.locale,
        phone: sql`coalesce(${input.phone ?? null}, ${contacts.phone})`,
        company: sql`coalesce(${input.company ?? null}, ${contacts.company})`,
      },
    })
    .returning();
  return contact;
}

/**
 * Stores a message from the public site, sends the visitor an acknowledgment
 * (stored as the first outbound message so later replies stay in the same
 * e-mail thread) and notifies Isaac.
 */
export async function receiveInbound(input: InboundInput, meta: RequestMeta): Promise<{ conversation: Conversation }> {
  const db = getDb();
  const contact = await upsertContact(input);
  const topicLabel = TOPIC_LABELS[input.locale][input.topic];
  const subject = input.subject ?? `${topicLabel} : ${input.name}`;

  const conversation = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(conversations)
      .values({ contactId: contact.id, subject, topic: input.topic, source: input.source ?? "contact_form" })
      .returning();
    await tx.insert(messages).values({
      conversationId: created.id,
      direction: "inbound",
      bodyText: input.message,
      attachments: input.attachments ?? [],
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return created;
  });

  // Acknowledgment to the visitor, root of the e-mail thread.
  const ack = await renderMail(
    createElement(ContactAckEmail, {
      name: input.name,
      locale: input.locale,
      message: input.message,
      kind: input.source === "quote_form" ? "quote" : "contact",
    }),
  );
  const ackId = newMessageId();
  const ackResult = await sendMailOrQueue({ to: contact.email, subject: ACK_SUBJECT[input.locale], ...ack }, ackId);
  await db.insert(messages).values({
    conversationId: conversation.id,
    direction: "outbound",
    bodyText: ack.text,
    bodyHtml: null,
    emailMessageId: ackId,
    deliveryStatus: ackResult.sent ? "sent" : "queued",
    deliveryError: ackResult.error ?? null,
    readAt: new Date(),
  });

  // Notification to Isaac, he can answer from the admin or directly by e-mail.
  const notification = await renderMail(
    createElement(AdminNotificationEmail, {
      title: input.source === "quote_form" ? "Nouvelle demande de devis" : "Nouveau message du site",
      fields: [
        ["Nom", input.name],
        ["E-mail", contact.email],
        ...(input.phone ? ([["Téléphone", input.phone]] as [string, string][]) : []),
        ["Sujet", topicLabel],
        ["Langue", input.locale.toUpperCase()],
      ],
      body: input.message,
      url: new URL(`/admin/messagerie/${conversation.id}`, getSiteUrl()).toString(),
    }),
  );
  await sendMailOrQueue({ to: await adminRecipient(), subject: `[Site] ${subject}`, replyTo: contact.email, ...notification });

  await notifyAdmins({
    type: input.source === "quote_form" ? "quote_request" : "message",
    title: input.source === "quote_form" ? `Demande de devis : ${input.name}` : `Nouveau message : ${input.name}`,
    body: input.message.slice(0, 200),
    url: `/admin/messagerie/${conversation.id}`,
  });
  return { conversation };
}

/** Message-IDs of the conversation, oldest first, for In-Reply-To and References. */
async function threadIds(conversationId: string): Promise<string[]> {
  const rows = await getDb()
    .select({ id: messages.emailMessageId })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), isNotNull(messages.emailMessageId)))
    .orderBy(asc(messages.sentAt));
  return rows.map((row) => row.id!).filter(Boolean);
}

export interface ReplyInput {
  conversationId: string;
  body: string;
  authorId: string;
}

export type ReplyResult = { ok: true; delivered: boolean } | { ok: false; error: string };

/** Sends a reply from the admin inside the visitor's existing e-mail thread. */
export async function replyToConversation(input: ReplyInput, meta: RequestMeta): Promise<ReplyResult> {
  const db = getDb();
  const [row] = await db
    .select({ conversation: conversations, contact: contacts })
    .from(conversations)
    .innerJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(eq(conversations.id, input.conversationId))
    .limit(1);
  if (!row) return { ok: false, error: "Conversation introuvable." };
  const locale = (row.contact.locale === "en" ? "en" : "fr") as Locale;
  const body = cleanTypography(input.body.trim(), locale);
  if (body.length < 2) return { ok: false, error: "La réponse est vide." };

  const ids = await threadIds(row.conversation.id);
  const [lastInbound] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.conversationId, row.conversation.id), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.sentAt))
    .limit(1);

  const bodyHtml = textToHtml(body);
  const dateFormat = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
  const rendered = await renderMail(
    createElement(ReplyEmail, {
      bodyHtml,
      locale,
      quoted: lastInbound ? { author: row.contact.name, date: dateFormat.format(lastInbound.sentAt), text: lastInbound.bodyText } : undefined,
    }),
  );

  const messageId = newMessageId();
  const subject = `Re: ${ACK_SUBJECT[locale]}`;
  const result = await sendMailOrQueue(
    { to: row.contact.email, subject, ...rendered, inReplyTo: ids.at(-1) ?? null, references: ids },
    messageId,
  );

  await db.transaction(async (tx) => {
    await tx.insert(messages).values({
      conversationId: row.conversation.id,
      direction: "outbound",
      bodyText: body,
      bodyHtml,
      emailMessageId: messageId,
      inReplyTo: ids.at(-1) ?? null,
      references: ids.join(" ") || null,
      authorId: input.authorId,
      deliveryStatus: result.sent ? "sent" : "queued",
      deliveryError: result.error ?? null,
      readAt: new Date(),
    });
    await tx
      .update(conversations)
      .set({ status: "replied", lastMessageAt: new Date() })
      .where(eq(conversations.id, row.conversation.id));
  });
  await writeAudit({ actorId: input.authorId, action: "conversation.reply", entityType: "conversation", entityId: row.conversation.id, ...meta });
  return { ok: true, delivered: result.sent };
}

export async function setConversationStatus(
  conversationId: string,
  status: Conversation["status"],
  actorId: string,
  meta: RequestMeta,
): Promise<void> {
  await getDb().update(conversations).set({ status }).where(eq(conversations.id, conversationId));
  await writeAudit({ actorId, action: `conversation.${status}`, entityType: "conversation", entityId: conversationId, ...meta });
}

/** Marks every inbound message of a conversation as read and moves "new" to "open". */
export async function markConversationRead(conversationId: string): Promise<void> {
  const db = getDb();
  await db
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, conversationId), sql`${messages.readAt} is null`));
  await db
    .update(conversations)
    .set({ status: "open" })
    .where(and(eq(conversations.id, conversationId), eq(conversations.status, "new")));
}

/** Creates a client from the contact of a conversation, or returns the linked one. */
export async function convertContactToClient(contactId: string, actorId: string, meta: RequestMeta): Promise<string> {
  const db = getDb();
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) throw new Error("Contact introuvable.");
  if (contact.clientId) return contact.clientId;
  const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.email, contact.email)).limit(1);
  const clientId =
    existing?.id ??
    (
      await db
        .insert(clients)
        .values({
          type: contact.company ? "company" : "person",
          name: contact.company ?? contact.name,
          contactName: contact.company ? contact.name : null,
          email: contact.email,
          phone: contact.phone,
          whatsapp: contact.phone,
        })
        .returning({ id: clients.id })
    )[0].id;
  await db.update(contacts).set({ clientId }).where(eq(contacts.id, contactId));
  await writeAudit({ actorId, action: "contact.converted", entityType: "client", entityId: clientId, diff: { contactId }, ...meta });
  return clientId;
}

export async function unreadCount(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(conversations)
    .where(inArray(conversations.status, ["new"]));
  return row?.total ?? 0;
}
