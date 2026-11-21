/** Nightly maintenance of the monitoring data: daily aggregates and retention. */
import { sql } from "drizzle-orm";
import { getDb } from "@/server/db";

/**
 * Aggregates one Bukavu day into daily_stats (idempotent: values are replaced).
 * Metrics: views, visitors, views per path, country, device and source, events per name.
 */
export async function aggregateDay(day: string): Promise<number> {
  const db = getDb();
  const from = `${day}T00:00:00+02:00`;
  const rows = await db.execute<{ count: number }>(sql`
    with bounds as (select ${from}::timestamptz as start, ${from}::timestamptz + interval '1 day' as stop),
    views as (select * from page_views, bounds where created_at >= bounds.start and created_at < bounds.stop),
    events as (select * from analytics_events, bounds where created_at >= bounds.start and created_at < bounds.stop),
    aggregated as (
      select 'views' as metric, '' as dimension, count(*)::int as value from views
      union all select 'visitors', '', count(distinct visitor_hash)::int from views
      union all select 'path', path, count(*)::int from views group by path
      union all select 'country', coalesce(country, '?'), count(*)::int from views group by country
      union all select 'device', coalesce(device, '?'), count(*)::int from views group by device
      union all select 'source', coalesce(utm_source, referrer, 'direct'), count(*)::int from views group by coalesce(utm_source, referrer, 'direct')
      union all select 'event', name, count(*)::int from events group by name
    ),
    upserted as (
      insert into daily_stats (day, metric, dimension, value)
      select ${day}::date, metric, left(dimension, 300), value from aggregated where value > 0
      on conflict (day, metric, dimension) do update set value = excluded.value
      returning 1
    )
    select count(*)::int as count from upserted
  `);
  return rows[0]?.count ?? 0;
}

/** Retention: raw audience 13 months, security events 12 months, errors 3 months. */
export async function purgeMonitoring(): Promise<number> {
  const db = getDb();
  const results = await Promise.all([
    db.execute(sql`delete from page_views where created_at < now() - interval '13 months'`),
    db.execute(sql`delete from analytics_events where created_at < now() - interval '13 months'`),
    db.execute(sql`delete from security_events where created_at < now() - interval '12 months'`),
    db.execute(sql`delete from error_logs where created_at < now() - interval '3 months'`),
    db.execute(sql`delete from ip_reputation where last_seen_at < now() - interval '90 days' and bans_count = 0`),
  ]);
  return results.reduce((sum, result) => sum + (result.count ?? 0), 0);
}

/** Yesterday in Bukavu, as YYYY-MM-DD. */
export function yesterdayLocal(now = new Date()): string {
  return new Date(now.getTime() + 2 * 3600_000 - 86_400_000).toISOString().slice(0, 10);
}
