import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { auditLogs, contacts, conversations, loginAttempts, quoteRequests, users } from "../db/schema";

/** Everything the dashboard needs, in parallel. */
export async function dashboardData(userId: string) {
  const db = getDb();
  const [totals, quotesByCurrency, recentMessages, recentRequests, activity, attempts, [account]] = await Promise.all([
    db.execute<{
      new_messages: number;
      open_messages: number;
      new_requests: number;
      published_projects: number;
      published_posts: number;
      draft_posts: number;
      to_review: number;
      backup_codes: number;
    }>(sql`
      select
        (select count(*)::int from conversations where status = 'new') as new_messages,
        (select count(*)::int from conversations where status in ('new', 'open')) as open_messages,
        (select count(*)::int from quote_requests where status in ('new', 'reviewing')) as new_requests,
        (select count(*)::int from projects where status = 'published' and deleted_at is null) as published_projects,
        (select count(*)::int from posts where status = 'published' and deleted_at is null) as published_posts,
        (select count(*)::int from posts where status = 'draft' and deleted_at is null) as draft_posts,
        (
          (select count(*)::int from projects where needs_review and deleted_at is null) +
          (select count(*)::int from journey_items where needs_review and deleted_at is null) +
          (select count(*)::int from testimonials where needs_review) +
          (select count(*)::int from posts where needs_review and deleted_at is null)
        ) as to_review,
        (select count(*)::int from backup_codes where user_id = ${userId} and used_at is null) as backup_codes
    `),
    db.execute<{ currency: "USD" | "CDF"; pending: number; accepted: number; count: number }>(sql`
      select currency,
        coalesce(sum(total) filter (where status in ('sent', 'viewed')), 0)::int as pending,
        coalesce(sum(total) filter (where status = 'accepted'), 0)::int as accepted,
        count(*) filter (where status in ('sent', 'viewed'))::int as count
      from quotes where deleted_at is null group by currency
    `),
    db
      .select({ id: conversations.id, subject: conversations.subject, status: conversations.status, at: conversations.lastMessageAt, name: contacts.name })
      .from(conversations)
      .innerJoin(contacts, eq(contacts.id, conversations.contactId))
      .where(sql`${conversations.status} <> 'spam'`)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(5),
    db
      .select({ id: quoteRequests.id, type: quoteRequests.projectType, budget: quoteRequests.budgetRange, status: quoteRequests.status, at: quoteRequests.createdAt, name: contacts.name, company: contacts.company })
      .from(quoteRequests)
      .innerJoin(contacts, eq(contacts.id, quoteRequests.contactId))
      .orderBy(desc(quoteRequests.createdAt))
      .limit(5),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, at: auditLogs.createdAt, actor: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(8),
    db.select().from(loginAttempts).orderBy(desc(loginAttempts.createdAt)).limit(6),
    db.select({ totpEnabledAt: users.totpEnabledAt, lastLoginAt: users.lastLoginAt, lastLoginIp: users.lastLoginIp }).from(users).where(eq(users.id, userId)),
  ]);
  return { totals: totals[0], quotesByCurrency: [...quotesByCurrency], recentMessages, recentRequests, activity, attempts, account };
}

/** Human readable labels of audit actions. */
export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Connexion",
  "auth.login_backup_code": "Connexion avec un code de secours",
  "auth.logout": "Déconnexion",
  "auth.totp_enabled": "Double authentification activée",
  "auth.totp_disabled": "Double authentification désactivée",
  "auth.password_changed": "Mot de passe modifié",
  "auth.password_reset": "Mot de passe réinitialisé",
  "auth.account_locked": "Compte verrouillé",
  "project.create": "Projet créé",
  "project.update": "Projet modifié",
  "project.delete": "Projet supprimé",
  "post.create": "Article créé",
  "post.update": "Article modifié",
  "album.create": "Album créé",
  "album.update": "Album modifié",
  "settings.update": "Paramètres modifiés",
  "media.upload": "Média envoyé",
  "media.update": "Média modifié",
  "conversation.reply": "Réponse envoyée",
  "quote.create": "Devis créé",
  "quote.update": "Devis modifié",
  "quote.sent_email": "Devis envoyé par e-mail",
  "quote.sent_whatsapp": "Devis envoyé par WhatsApp",
  "quote.accepted": "Devis accepté par le client",
  "quote.declined": "Devis refusé par le client",
  "quote.converted": "Devis converti en client",
};
