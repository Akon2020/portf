/**
 * Records detections, updates the IP reputation and bans automatically
 * past the configured threshold.
 */
import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { readSettingUncached } from "@/server/content/settings-store";
import { getDb } from "@/server/db";
import { ipReputation, jobs, type SecurityCategory, type SecuritySeverity } from "@/server/db/schema";
import { banDuration, banIp, ipStatus } from "./bans";
import type { Detection } from "./rules";
import { track } from "./transport";

export interface RequestInfo {
  ip: string;
  method: string;
  path: string;
  query: string;
  userAgent: string | null;
  country?: string | null;
}

export interface SecuritySignal {
  ruleId: string;
  category: SecurityCategory;
  severity: SecuritySeverity;
  score: number;
  excerpt?: string;
}

const SEVERITY_RANK: Record<SecuritySeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

/** Text stored for display only: control characters removed, length capped. */
function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.replace(/[\u0000-\u001f\u007f]/gu, " ").slice(0, max);
}

/**
 * Stores the signals of one request, adds their score to the IP reputation
 * (with a 24 h half-life) and bans the IP past the threshold.
 * Returns the action taken.
 */
export async function recordSignals(request: RequestInfo, signals: (Detection | SecuritySignal)[], action: "logged" | "blocked" = "logged"): Promise<"logged" | "blocked" | "banned"> {
  if (signals.length === 0) return action;
  const status = await ipStatus(request.ip);
  const total = signals.reduce((sum, signal) => sum + signal.score, 0);
  const db = getDb();
  let outcome: "logged" | "blocked" | "banned" = action;

  if (!status.allowed) {
    const categories = [...new Set(signals.map((signal) => signal.category))];
    // Exponential decay: the stored score halves every 24 hours of silence.
    const [reputation] = await db
      .insert(ipReputation)
      .values({ ip: request.ip, score: total, eventsCount: signals.length, categories })
      .onConflictDoUpdate({
        target: ipReputation.ip,
        set: {
          score: sql`floor(${ipReputation.score} * power(0.5, extract(epoch from (now() - ${ipReputation.lastSeenAt})) / 86400))::int + ${total}`,
          lastSeenAt: sql`now()`,
          eventsCount: sql`${ipReputation.eventsCount} + ${signals.length}`,
          categories: sql`(select coalesce(jsonb_agg(distinct value), '[]'::jsonb) from jsonb_array_elements_text(${ipReputation.categories} || ${JSON.stringify(categories)}::jsonb))`,
        },
      })
      .returning();
    const settings = await readSettingUncached("security");
    if (reputation.score >= settings.autoBanThreshold && !status.banned) {
      const strongest = [...signals].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])[0];
      await banIp({
        ipOrCidr: request.ip,
        reason: `Score ${reputation.score} (${categories.join(", ")})`,
        source: "auto",
        ruleId: strongest.ruleId,
        durationMs: banDuration(reputation.bansCount),
      });
      outcome = "banned";
      if (settings.alertOnAutoBan) await scheduleSecurityAlert();
    } else if (settings.alertOnCritical && signals.some((signal) => signal.severity === "critical")) {
      await scheduleSecurityAlert();
    }
  }

  await track(
    ...signals.map((signal) => ({
      type: "security_event" as const,
      data: {
        ip: request.ip,
        method: request.method.slice(0, 16),
        path: clean(request.path, 500) ?? "/",
        query: clean(request.query, 500),
        userAgent: clean(request.userAgent, 400),
        category: signal.category,
        ruleId: signal.ruleId,
        severity: signal.severity,
        score: signal.score,
        payloadExcerpt: clean("excerpt" in signal ? signal.excerpt : null, 500),
        country: request.country ?? null,
        actionTaken: outcome,
      },
    })),
  );
  return outcome;
}

/** Security signal raised by the application itself (brute force, rate limits, invalid tokens). */
export async function recordAppSignal(request: RequestInfo, signal: SecuritySignal): Promise<void> {
  try {
    await recordSignals(request, [signal]);
  } catch (error) {
    console.error("[monitoring] signal failed", error instanceof Error ? error.message : error);
  }
}

/** Alerts are grouped: one job five minutes later summarizes everything since the previous alert. */
export async function scheduleSecurityAlert(): Promise<void> {
  const db = getDb();
  const [pending] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, "security.alert"), eq(jobs.status, "pending")))
    .limit(1);
  if (pending) return;
  const { enqueueJob } = await import("@/server/jobs/queue");
  await enqueueJob("security.alert", { since: new Date(Date.now() - 10 * 60_000).toISOString() }, { runAt: new Date(Date.now() + 5 * 60_000) });
}

/** Daily salted hash: counts unique visitors without storing their IP. */
export function visitorHash(ip: string, userAgent: string, now = new Date()): string {
  const salt = `${process.env.IP_HASH_SALT_SECRET ?? process.env.AUTH_ENCRYPTION_KEY ?? "portfolio"}:${now.toISOString().slice(0, 10)}`;
  return createHash("sha256").update(`${salt}:${ip}:${userAgent}`).digest("hex").slice(0, 32);
}
