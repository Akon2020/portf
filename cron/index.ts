/**
 * Entry point of the cPanel Cron Jobs, compiled to dist/cron.js.
 *   node dist/cron.js <task> [arguments]
 */
import { loadEnvConfig } from "@next/env";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/server/db";
import { authTokens, cronRuns, sessions } from "../src/server/db/schema";
import { purgeExpiredRateLimits } from "../src/server/auth/rate-limit";
import { createAdmin } from "../src/server/cli/create-admin";
import { healthcheck } from "../src/server/cli/healthcheck";
import { registerJobHandlers } from "../src/server/jobs/handlers";
import { runDueJobs } from "../src/server/jobs/runner";
import { syncBans } from "../src/monitoring/ban-sync";
import { aggregateDay, purgeMonitoring, yesterdayLocal } from "../src/monitoring/maintenance";
import { markOverdueInvoices } from "../src/server/services/invoices";
import { generateVapidKeys } from "../src/server/services/push";
import { expireQuotes } from "../src/server/services/quotes";
import { sendDailyDigest } from "../src/server/services/tasks";

loadEnvConfig(process.cwd());
registerJobHandlers();

type Task = (args: string[]) => Promise<{ code?: number; processed?: number }>;

const tasks: Record<string, { task: Task; tracked: boolean }> = {
  healthcheck: { tracked: false, task: async () => ({ code: await healthcheck() }) },
  "create-admin": { tracked: false, task: async (args) => ({ code: await createAdmin(args) }) },
  "run-jobs": {
    tracked: true,
    task: async () => {
      const result = await runDueJobs();
      // Upstream ban synchronization rides on the 5 minute cron when enabled.
      const synced = process.env.BAN_SYNC && process.env.BAN_SYNC !== "none" ? await syncBans().catch((error) => {
        console.error(error instanceof Error ? error.message : error);
        return 0;
      }) : 0;
      return { processed: result.processed + synced, code: 0 };
    },
  },
  nightly: {
    tracked: true,
    task: async (args) => {
      const db = getDb();
      const rateLimits = await purgeExpiredRateLimits();
      const oldSessions = await db
        .delete(sessions)
        .where(sql`${sessions.absoluteExpiresAt} < now() - interval '7 days'`)
        .returning({ id: sessions.id });
      const oldTokens = await db
        .delete(authTokens)
        .where(sql`${authTokens.expiresAt} < now() - interval '7 days'`)
        .returning({ id: authTokens.id });
      const expiredQuotes = await expireQuotes();
      const overdueInvoices = await markOverdueInvoices();
      const aggregated = await aggregateDay(args[0] && /^d{4}-d{2}-d{2}$/.test(args[0]) ? args[0] : yesterdayLocal());
      const purged = await purgeMonitoring();
      return { processed: rateLimits + oldSessions.length + oldTokens.length + expiredQuotes + overdueInvoices + aggregated + purged };
    },
  },
  "sync-bans": {
    tracked: true,
    task: async () => ({ processed: await syncBans(), code: 0 }),
  },
  "daily-digest": {
    tracked: true,
    task: async () => ({ processed: await sendDailyDigest(), code: 0 }),
  },
  "vapid-keys": {
    tracked: false,
    task: async () => {
      const keys = generateVapidKeys();
      console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}
VAPID_PRIVATE_KEY=${keys.privateKey}`);
      return { code: 0 };
    },
  },
};

async function main(): Promise<number> {
  const [name, ...args] = process.argv.slice(2);
  const entry = name ? tasks[name] : undefined;
  if (!entry) {
    console.error(`Tâche inconnue. Tâches disponibles : ${Object.keys(tasks).join(", ")}`);
    return 1;
  }
  if (!entry.tracked) return (await entry.task(args)).code ?? 0;

  const db = getDb();
  const [run] = await db.insert(cronRuns).values({ task: name }).returning({ id: cronRuns.id });
  try {
    const result = await entry.task(args);
    await db
      .update(cronRuns)
      .set({ status: "success", finishedAt: new Date(), processed: result.processed ?? 0 })
      .where(eq(cronRuns.id, run.id));
    return result.code ?? 0;
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    await db
      .update(cronRuns)
      .set({ status: "failed", finishedAt: new Date(), error: message.slice(0, 4000) })
      .where(eq(cronRuns.id, run.id));
    console.error(message);
    return 1;
  }
}

main()
  .then(async (code) => {
    await closeDb();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
