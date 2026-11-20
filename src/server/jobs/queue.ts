import { getDb } from "../db";
import { jobs } from "../db/schema";

export type JobType = "mail.security_alert" | "mail.new_login" | (string & {});

/** Adds a job to the queue. It runs on the next pass of the run-jobs cron. */
export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown> = {},
  options: { runAt?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const [job] = await getDb()
    .insert(jobs)
    .values({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 3,
    })
    .returning({ id: jobs.id });
  return job.id;
}
