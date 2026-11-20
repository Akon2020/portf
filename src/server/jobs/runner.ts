import { hostname } from "node:os";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { jobs } from "../db/schema";

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

/** Handlers are registered by each module. Jobs without a handler stay pending. */
const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function registeredJobTypes(): string[] {
  return [...handlers.keys()];
}

/** Exponential backoff: 1 min, 5 min, 25 min. */
export function retryDelayMs(attempt: number): number {
  return 60_000 * 5 ** Math.max(0, attempt - 1);
}

export interface RunJobsResult {
  processed: number;
  failed: number;
}

/**
 * Claims due jobs with FOR UPDATE SKIP LOCKED so overlapping cron runs never
 * process the same job, then runs them until the time budget is spent.
 */
export async function runDueJobs(options: { budgetMs?: number; batchSize?: number } = {}): Promise<RunJobsResult> {
  const budgetMs = options.budgetMs ?? 4 * 60_000;
  const batchSize = options.batchSize ?? 20;
  const workerId = `${hostname()}:${process.pid}`;
  const started = Date.now();
  const types = registeredJobTypes();
  const result: RunJobsResult = { processed: 0, failed: 0 };
  if (types.length === 0) return result;
  const db = getDb();

  // Jobs stuck in running for more than 10 minutes come back to the queue.
  await db
    .update(jobs)
    .set({ status: "pending", lockedAt: null, lockedBy: null })
    .where(sql`${jobs.status} = 'running' and ${jobs.lockedAt} < now() - interval '10 minutes'`);

  while (Date.now() - started < budgetMs) {
    const claimed = await db.transaction(async (tx) => {
      const due = await tx
        .select({ id: jobs.id })
        .from(jobs)
        .where(sql`${jobs.status} = 'pending' and ${jobs.runAt} <= now() and ${inArray(jobs.type, types)}`)
        .orderBy(jobs.runAt)
        .limit(batchSize)
        .for("update", { skipLocked: true });
      if (due.length === 0) return [];
      return tx
        .update(jobs)
        .set({ status: "running", lockedAt: new Date(), lockedBy: workerId, attempts: sql`${jobs.attempts} + 1` })
        .where(inArray(jobs.id, due.map((row) => row.id)))
        .returning();
    });
    if (claimed.length === 0) break;

    for (const job of claimed) {
      try {
        await handlers.get(job.type)!(job.payload);
        await db
          .update(jobs)
          .set({ status: "done", completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null })
          .where(eq(jobs.id, job.id));
        result.processed++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const exhausted = job.attempts >= job.maxAttempts;
        await db
          .update(jobs)
          .set({
            status: exhausted ? "failed" : "pending",
            runAt: new Date(Date.now() + retryDelayMs(job.attempts)),
            lastError: message.slice(0, 2000),
            lockedAt: null,
            lockedBy: null,
          })
          .where(eq(jobs.id, job.id));
        result.failed++;
      }
    }
  }
  return result;
}
