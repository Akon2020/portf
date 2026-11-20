import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "../db";
import { contacts, conversations, messages, quoteRequests, users } from "../db/schema";

export const CONVERSATION_FILTERS = ["all", "new", "open", "replied", "closed", "spam"] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

export async function listConversations(filter: ConversationFilter, search?: string) {
  const conditions: SQL[] = [];
  if (filter !== "all") conditions.push(eq(conversations.status, filter));
  else conditions.push(sql`${conversations.status} <> 'spam'`);
  if (search?.trim()) {
    const term = `%${search.trim().replace(/[%_]/g, "")}%`;
    conditions.push(or(ilike(contacts.name, term), ilike(contacts.email, term), ilike(conversations.subject, term))!);
  }
  return getDb()
    .select({
      id: conversations.id,
      subject: conversations.subject,
      status: conversations.status,
      source: conversations.source,
      lastMessageAt: conversations.lastMessageAt,
      contactName: contacts.name,
      contactEmail: contacts.email,
      excerpt: sql<string>`(select left(m.body_text, 160) from ${messages} m where m.conversation_id = ${conversations.id} and m.direction = 'inbound' order by m.sent_at desc limit 1)`,
      unread: sql<number>`(select count(*)::int from ${messages} m where m.conversation_id = ${conversations.id} and m.direction = 'inbound' and m.read_at is null)`,
    })
    .from(conversations)
    .innerJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(and(...conditions))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(200);
}

export async function countByStatus() {
  const rows = await getDb()
    .select({ status: conversations.status, total: sql<number>`count(*)::int` })
    .from(conversations)
    .groupBy(conversations.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.total])) as Record<string, number>;
}

export async function getConversation(id: string) {
  const db = getDb();
  const [row] = await db
    .select({ conversation: conversations, contact: contacts })
    .from(conversations)
    .innerJoin(contacts, eq(contacts.id, conversations.contactId))
    .where(eq(conversations.id, id))
    .limit(1);
  if (!row) return null;
  const [thread, request] = await Promise.all([
    db
      .select({ message: messages, authorName: users.name })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.sentAt)),
    db.select().from(quoteRequests).where(eq(quoteRequests.conversationId, id)).limit(1),
  ]);
  return { ...row, thread, quoteRequest: request[0] ?? null };
}
