import { index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { clientProjects, milestones } from "./billing";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";
import { jobs } from "./infra";

export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "blocked", "done"]);
export const taskPriority = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);
export const reminderStatus = pgEnum("reminder_status", ["pending", "sent", "cancelled", "failed"]);

export type ChecklistItem = { id: string; label: string; done: boolean };
export type ReminderChannel = "email" | "push";

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description"),
    clientProjectId: uuid("client_project_id").references(() => clientProjects.id, { onDelete: "set null" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    status: taskStatus("status").notNull().default("todo"),
    priority: taskPriority("priority").notNull().default("medium"),
    dueAt: timestamptz("due_at"),
    startAt: timestamptz("start_at"),
    estimateMinutes: integer("estimate_minutes"),
    /** Subset of RFC 5545: FREQ=DAILY|WEEKLY|MONTHLY, INTERVAL, BYDAY for weekly rules. */
    recurrenceRule: text("recurrence_rule"),
    /** Previous occurrence of a recurring series. */
    recurrenceParentId: uuid("recurrence_parent_id"),
    labels: jsonb("labels").$type<string[]>().notNull().default([]),
    checklist: jsonb("checklist").$type<ChecklistItem[]>().notNull().default([]),
    /** Reminder offsets in minutes before the due date, for example [1440, 60]. */
    reminderOffsets: jsonb("reminder_offsets").$type<number[]>().notNull().default([]),
    reminderChannels: jsonb("reminder_channels").$type<ReminderChannel[]>().notNull().default(["email"]),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamptz("completed_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [index("tasks_status_due_idx").on(table.status, table.dueAt), index("tasks_project_idx").on(table.clientProjectId)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull().default("task"),
    entityId: uuid("entity_id"),
    remindAt: timestamptz("remind_at").notNull(),
    channels: jsonb("channels").$type<ReminderChannel[]>().notNull().default(["email"]),
    status: reminderStatus("status").notNull().default("pending"),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    sentAt: timestamptz("sent_at"),
    createdAt: createdAt(),
  },
  (table) => [index("reminders_task_idx").on(table.taskId), index("reminders_status_idx").on(table.status, table.remindAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
    userAgent: text("user_agent"),
    lastUsedAt: timestamptz("last_used_at"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("push_subscriptions_endpoint_idx").on(table.endpoint)],
);

export type Task = typeof tasks.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type TaskStatus = (typeof taskStatus.enumValues)[number];
export type TaskPriority = (typeof taskPriority.enumValues)[number];
