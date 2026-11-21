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
      security_events: number;
      active_bans: number;
      tasks_today: number;
      tasks_overdue: number;
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
        (select count(*)::int from backup_codes where user_id = ${userId} and used_at is null) as backup_codes,
        (select count(*)::int from security_events where created_at >= now() - interval '24 hours') as security_events,
        (select count(*)::int from ip_bans where lifted_at is null and (expires_at is null or expires_at > now())) as active_bans,
        (select count(*)::int from tasks where deleted_at is null and status <> 'done' and due_at >= now() and (due_at at time zone 'Africa/Lubumbashi')::date = (now() at time zone 'Africa/Lubumbashi')::date) as tasks_today,
        (select count(*)::int from tasks where deleted_at is null and status <> 'done' and due_at < now()) as tasks_overdue
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

/** Series for the dashboard charts: last 30 days of visits, 12 months of revenue, pipelines by status. */
export async function dashboardCharts() {
  const db = getDb();
  const [visits, revenue, quoteStatuses, invoiceStatuses, requestStatuses, taskStatuses] = await Promise.all([
    db.execute<{ day: string; views: number; visitors: number }>(sql`
      with days as (
        select generate_series(((now() at time zone 'Africa/Lubumbashi')::date - 29), (now() at time zone 'Africa/Lubumbashi')::date, interval '1 day')::date as day
      )
      select to_char(days.day, 'YYYY-MM-DD') as day, count(pv.id)::int as views, count(distinct pv.visitor_hash)::int as visitors
      from days left join page_views pv on (pv.created_at at time zone 'Africa/Lubumbashi')::date = days.day
      group by days.day order by days.day
    `),
    db.execute<{ month: string; currency: "USD" | "CDF"; amount: number }>(sql`
      with months as (
        select to_char(generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month'), 'YYYY-MM') as month
      )
      select months.month, c.currency, coalesce(sum(p.amount), 0)::int as amount
      from months cross join (values ('USD'), ('CDF')) as c(currency)
      left join payments p on to_char(p.paid_at, 'YYYY-MM') = months.month and p.currency::text = c.currency
      group by months.month, c.currency order by months.month
    `),
    db.execute<{ status: string; count: number }>(sql`select status::text, count(*)::int as count from quotes where deleted_at is null group by status`),
    db.execute<{ status: string; count: number }>(sql`select status::text, count(*)::int as count from invoices where deleted_at is null group by status`),
    db.execute<{ status: string; count: number }>(sql`select status::text, count(*)::int as count from quote_requests group by status`),
    db.execute<{ status: string; count: number }>(sql`select status::text, count(*)::int as count from tasks where deleted_at is null group by status`),
  ]);
  return {
    visits: [...visits],
    revenue: [...revenue],
    quoteStatuses: [...quoteStatuses],
    invoiceStatuses: [...invoiceStatuses],
    requestStatuses: [...requestStatuses],
    taskStatuses: [...taskStatuses],
  };
}

const ENTITY_LABELS: Record<string, string> = {
  testimonial: "Témoignage",
  journey: "Parcours",
  skill: "Compétence",
  service: "Service",
  stat: "Chiffre clé",
  social: "Réseau social",
  project: "Projet",
  post: "Article",
  album: "Album",
  media: "Média",
  client: "Client",
  client_project: "Projet client",
  milestone: "Jalon",
  invoice: "Facture",
  receipt: "Reçu",
  quote: "Devis",
  quote_request: "Demande de devis",
  task: "Tâche",
  contact: "Contact",
  conversation: "Conversation",
  security: "Sécurité",
  portal: "Espace client",
  settings: "Paramètres",
  auth: "Connexion",
};

const VERB_LABELS: Record<string, string> = {
  create: "création",
  update: "modification",
  delete: "suppression",
  duplicate: "duplication",
  status: "changement de statut",
  payment: "paiement enregistré",
  sent_email: "envoi par e-mail",
  sent_whatsapp: "envoi par WhatsApp",
  reminder_email: "relance par e-mail",
  reminder_whatsapp: "relance par WhatsApp",
  cancelled: "annulation",
  negotiation: "proposition du client",
  negotiation_reply: "réponse à la négociation",
  revision: "nouvelle version",
  balance: "facture de solde",
  ban: "bannissement",
  unban: "levée de bannissement",
  allow: "ajout à la liste blanche",
  login: "connexion",
};

/** Readable label of any audit action, for example "Témoignage : modification". */
export function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(".");
  const entityLabel = ENTITY_LABELS[entity] ?? entity;
  return verb ? `${entityLabel} : ${VERB_LABELS[verb] ?? verb.replace(/_/g, " ")}` : entityLabel;
}
