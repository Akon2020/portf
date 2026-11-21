import { and, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { activeBanCondition, banIp, invalidateBanCache, isValidIpOrCidr, liftBan } from "@/monitoring/bans";
import { getDb } from "../db";
import {
  auditLogs,
  cronRuns,
  documentSends,
  errorLogs,
  ipAllowlist,
  ipBans,
  ipReputation,
  loginAttempts,
  securityEvents,
  users,
  type SecurityCategory,
  type SecuritySeverity,
} from "../db/schema";
import { writeAudit } from "./audit";
import type { RequestMeta } from "./inbox";

export interface Actor extends RequestMeta {
  id: string;
}

export class MonitoringError extends Error {}

const since = (days: number) => new Date(Date.now() - days * 86_400_000);

// Audience

export async function audienceOverview(days: number) {
  const db = getDb();
  const from = since(days).toISOString();
  const previous = since(days * 2).toISOString();
  const [totals, daily, pages, sources, countries, devices, events, realtime, funnel] = await Promise.all([
    db.execute<{ views: number; visitors: number; prev_views: number; prev_visitors: number }>(sql`
      select
        count(*) filter (where created_at >= ${from}::timestamptz)::int as views,
        count(distinct visitor_hash) filter (where created_at >= ${from}::timestamptz)::int as visitors,
        count(*) filter (where created_at < ${from}::timestamptz)::int as prev_views,
        count(distinct visitor_hash) filter (where created_at < ${from}::timestamptz)::int as prev_visitors
      from page_views where created_at >= ${previous}::timestamptz
    `),
    db.execute<{ day: string; views: number; visitors: number }>(sql`
      select to_char((created_at at time zone 'Africa/Lubumbashi')::date, 'YYYY-MM-DD') as day, count(*)::int as views, count(distinct visitor_hash)::int as visitors
      from page_views where created_at >= ${from}::timestamptz group by 1 order by 1
    `),
    db.execute<{ path: string; views: number; visitors: number }>(sql`
      select path, count(*)::int as views, count(distinct visitor_hash)::int as visitors from page_views
      where created_at >= ${from}::timestamptz group by path order by views desc limit 12
    `),
    db.execute<{ source: string; views: number }>(sql`
      select coalesce(utm_source, referrer, 'Accès direct') as source, count(*)::int as views from page_views
      where created_at >= ${from}::timestamptz group by 1 order by views desc limit 10
    `),
    db.execute<{ country: string; views: number }>(sql`
      select coalesce(country, '?') as country, count(*)::int as views from page_views
      where created_at >= ${from}::timestamptz group by 1 order by views desc limit 10
    `),
    db.execute<{ device: string; views: number }>(sql`
      select coalesce(device, '?') as device, count(*)::int as views from page_views
      where created_at >= ${from}::timestamptz group by 1 order by views desc
    `),
    db.execute<{ name: string; count: number }>(sql`
      select name, count(*)::int as count from analytics_events where created_at >= ${from}::timestamptz group by name order by count desc
    `),
    db.execute<{ views: number; visitors: number }>(sql`
      select count(*)::int as views, count(distinct visitor_hash)::int as visitors from page_views where created_at >= now() - interval '30 minutes'
    `),
    db.execute<{ project_views: number; quote_page: number; quote_submit: number; contact_submit: number }>(sql`
      select
        (select count(distinct visitor_hash)::int from page_views where created_at >= ${from}::timestamptz and (path like '/projets/%' or path like '/en/projects/%')) as project_views,
        (select count(distinct visitor_hash)::int from page_views where created_at >= ${from}::timestamptz and (path = '/devis' or path = '/en/quote')) as quote_page,
        (select count(*)::int from analytics_events where created_at >= ${from}::timestamptz and name = 'quote_submit') as quote_submit,
        (select count(*)::int from analytics_events where created_at >= ${from}::timestamptz and name = 'contact_submit') as contact_submit
    `),
  ]);
  return {
    totals: totals[0],
    daily: [...daily],
    pages: [...pages],
    sources: [...sources],
    countries: [...countries],
    devices: [...devices],
    events: [...events],
    realtime: realtime[0],
    funnel: funnel[0],
  };
}

// Security

export interface SecurityFilter {
  category?: string;
  severity?: string;
  ip?: string;
  days?: number;
}

export async function securityOverview(filter: SecurityFilter) {
  const db = getDb();
  const from = since(filter.days ?? 7);
  const conditions: SQL[] = [gte(securityEvents.createdAt, from)];
  if (filter.category) conditions.push(eq(securityEvents.category, filter.category as SecurityCategory));
  if (filter.severity) conditions.push(eq(securityEvents.severity, filter.severity as SecuritySeverity));
  if (filter.ip) conditions.push(ilike(securityEvents.ip, `${filter.ip.replace(/[%_]/g, "")}%`));
  const where = and(...conditions);
  const [events, byCategory, topIps, daily] = await Promise.all([
    db.select().from(securityEvents).where(where).orderBy(desc(securityEvents.createdAt)).limit(200),
    db
      .select({ category: securityEvents.category, count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(where)
      .groupBy(securityEvents.category)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ ip: securityEvents.ip, count: sql<number>`count(*)::int`, score: sql<number>`sum(${securityEvents.score})::int`, last: sql<Date>`max(${securityEvents.createdAt})` })
      .from(securityEvents)
      .where(where)
      .groupBy(securityEvents.ip)
      .orderBy(desc(sql`sum(${securityEvents.score})`))
      .limit(10),
    db.execute<{ day: string; count: number }>(sql`
      select to_char((created_at at time zone 'Africa/Lubumbashi')::date, 'YYYY-MM-DD') as day, count(*)::int as count
      from security_events where created_at >= ${from.toISOString()}::timestamptz group by 1 order by 1
    `),
  ]);
  return { events, byCategory, topIps, daily: [...daily] };
}

export async function ipDetail(ip: string) {
  const db = getDb();
  const [reputation, events, bans, allowed, methods] = await Promise.all([
    db.select().from(ipReputation).where(eq(ipReputation.ip, ip)).limit(1),
    db.select().from(securityEvents).where(eq(securityEvents.ip, ip)).orderBy(desc(securityEvents.createdAt)).limit(100),
    db.select().from(ipBans).where(eq(ipBans.ipOrCidr, ip)).orderBy(desc(ipBans.bannedAt)),
    db.select().from(ipAllowlist).where(eq(ipAllowlist.ipOrCidr, ip)).limit(1),
    db
      .select({ ruleId: securityEvents.ruleId, category: securityEvents.category, count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(eq(securityEvents.ip, ip))
      .groupBy(securityEvents.ruleId, securityEvents.category)
      .orderBy(desc(sql`count(*)`)),
  ]);
  const agents = [...new Set(events.map((event) => event.userAgent).filter(Boolean))].slice(0, 5) as string[];
  const countries = [...new Set(events.map((event) => event.country).filter(Boolean))] as string[];
  return { reputation: reputation[0] ?? null, events, bans, allowed: allowed[0] ?? null, methods, agents, countries };
}

export async function securityCounters() {
  const [row] = await getDb()
    .select({
      events: sql<number>`(select count(*)::int from security_events where created_at >= now() - interval '24 hours')`,
      critical: sql<number>`(select count(*)::int from security_events where created_at >= now() - interval '24 hours' and severity in ('high', 'critical'))`,
      bans: sql<number>`(select count(*)::int from ip_bans where lifted_at is null and (expires_at is null or expires_at > now()))`,
    })
    .from(sql`(select 1) as one`);
  return row;
}

// Bans and allowlist

export async function listBans(scope: "active" | "expired" | "lifted") {
  const db = getDb();
  const where =
    scope === "active" ? activeBanCondition() : scope === "lifted" ? isNotNull(ipBans.liftedAt) : and(isNull(ipBans.liftedAt), isNotNull(ipBans.expiresAt), lte(ipBans.expiresAt, new Date()));
  return db
    .select({ ban: ipBans, author: users.name })
    .from(ipBans)
    .leftJoin(users, eq(users.id, ipBans.createdBy))
    .where(where)
    .orderBy(desc(ipBans.bannedAt))
    .limit(300);
}

export async function manualBan(input: { ipOrCidr: string; reason: string; hours: number | null }, actor: Actor) {
  const value = input.ipOrCidr.trim().toLowerCase();
  if (!isValidIpOrCidr(value)) throw new MonitoringError("Adresse IP ou plage CIDR invalide.");
  if (value === actor.ip) throw new MonitoringError("Impossible de bannir votre propre adresse IP.");
  const [allowed] = await getDb().select().from(ipAllowlist).where(eq(ipAllowlist.ipOrCidr, value)).limit(1);
  if (allowed) throw new MonitoringError("Cette adresse est dans la liste blanche : retirez-la d'abord.");
  const ban = await banIp({ ipOrCidr: value, reason: input.reason.trim() || "Bannissement manuel", source: "manual", durationMs: input.hours ? input.hours * 3600_000 : null, createdBy: actor.id });
  await writeAudit({ actorId: actor.id, action: "security.ban", entityType: "ip", diff: { ip: value, hours: input.hours }, ip: actor.ip });
  return ban;
}

export async function manualLift(id: string, actor: Actor) {
  await liftBan(id);
  await writeAudit({ actorId: actor.id, action: "security.unban", entityType: "ip", diff: { banId: id }, ip: actor.ip });
}

export async function listAllowlist() {
  return getDb().select().from(ipAllowlist).orderBy(desc(ipAllowlist.createdAt));
}

export async function addToAllowlist(ipOrCidr: string, label: string, actor: Actor) {
  const value = ipOrCidr.trim().toLowerCase();
  if (!isValidIpOrCidr(value)) throw new MonitoringError("Adresse IP ou plage CIDR invalide.");
  await getDb()
    .insert(ipAllowlist)
    .values({ ipOrCidr: value, label: label.trim().slice(0, 120) || "Sans libellé" })
    .onConflictDoUpdate({ target: ipAllowlist.ipOrCidr, set: { label: label.trim().slice(0, 120) || "Sans libellé" } });
  // An allowed address is never banned: active bans on it are lifted.
  await getDb().update(ipBans).set({ liftedAt: new Date() }).where(and(eq(ipBans.ipOrCidr, value), activeBanCondition()));
  invalidateBanCache();
  await writeAudit({ actorId: actor.id, action: "security.allow", entityType: "ip", diff: { ip: value }, ip: actor.ip });
}

export async function removeFromAllowlist(id: string, actor: Actor) {
  await getDb().delete(ipAllowlist).where(eq(ipAllowlist.id, id));
  invalidateBanCache();
  await writeAudit({ actorId: actor.id, action: "security.disallow", entityType: "ip", diff: { id }, ip: actor.ip });
}

// Logs

export async function journal(kind: string) {
  const db = getDb();
  if (kind === "audit") {
    return { kind, rows: await db.select({ log: auditLogs, actor: users.name }).from(auditLogs).leftJoin(users, eq(users.id, auditLogs.actorId)).orderBy(desc(auditLogs.createdAt)).limit(200) };
  }
  if (kind === "envois") return { kind, rows: await db.select().from(documentSends).orderBy(desc(documentSends.sentAt)).limit(200) };
  if (kind === "cron") return { kind, rows: await db.select().from(cronRuns).orderBy(desc(cronRuns.startedAt)).limit(200) };
  if (kind === "erreurs") return { kind, rows: await db.select().from(errorLogs).orderBy(desc(errorLogs.createdAt)).limit(200) };
  return {
    kind: "connexions",
    rows: await db.select().from(loginAttempts).where(or(gte(loginAttempts.createdAt, since(90)))).orderBy(desc(loginAttempts.createdAt)).limit(300),
  };
}
