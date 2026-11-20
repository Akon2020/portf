import { index, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, timestamptz, updatedAt } from "./columns";

export const jobStatus = pgEnum("job_status", ["pending", "running", "done", "failed"]);
export const cronRunStatus = pgEnum("cron_run_status", ["running", "success", "failed"]);

/** Fixed window counters shared by every Passenger process. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamptz("window_start").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
  },
  (table) => [index("rate_limits_expires_at_idx").on(table.expiresAt)],
);

/** Home made job queue processed by the cPanel cron. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    runAt: timestamptz("run_at").notNull().defaultNow(),
    status: jobStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lastError: text("last_error"),
    lockedAt: timestamptz("locked_at"),
    lockedBy: text("locked_by"),
    completedAt: timestamptz("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("jobs_status_run_at_idx").on(table.status, table.runAt)],
);

export const cronRuns = pgTable(
  "cron_runs",
  {
    id: id(),
    task: text("task").notNull(),
    startedAt: timestamptz("started_at").notNull().defaultNow(),
    finishedAt: timestamptz("finished_at"),
    status: cronRunStatus("status").notNull().default("running"),
    processed: integer("processed").notNull().default(0),
    error: text("error"),
  },
  (table) => [index("cron_runs_task_started_idx").on(table.task, table.startedAt)],
);
