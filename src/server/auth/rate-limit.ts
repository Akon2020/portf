import { eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { rateLimits } from "../db/schema";

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  login: { limit: 5, windowSeconds: 15 * 60 },
  totp: { limit: 5, windowSeconds: 15 * 60 },
  magicLink: { limit: 3, windowSeconds: 60 * 60 },
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  contactForm: { limit: 3, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed window counter stored in PostgreSQL, so it holds across every
 * Passenger process. One atomic upsert per call.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const rows = await getDb().execute<{ count: number; expires_at: Date | string }>(sql`
    insert into ${rateLimits} (key, count, window_start, expires_at)
    values (${key}, 1, now(), now() + make_interval(secs => ${rule.windowSeconds}))
    on conflict (key) do update set
      count = case when ${rateLimits.expiresAt} <= now() then 1 else ${rateLimits.count} + 1 end,
      window_start = case when ${rateLimits.expiresAt} <= now() then now() else ${rateLimits.windowStart} end,
      expires_at = case when ${rateLimits.expiresAt} <= now()
        then now() + make_interval(secs => ${rule.windowSeconds})
        else ${rateLimits.expiresAt} end
    returning count, expires_at
  `);
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const expiresAt = new Date(row?.expires_at ?? Date.now());
  const allowed = count <= rule.limit;
  return {
    allowed,
    count,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await getDb().delete(rateLimits).where(eq(rateLimits.key, key));
}

/** Nightly clean-up of expired counters. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const deleted = await getDb()
    .delete(rateLimits)
    .where(sql`${rateLimits.expiresAt} < now()`)
    .returning({ key: rateLimits.key });
  return deleted.length;
}
