import { createElement } from "react";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { DigestEmail, TaskReminderEmail } from "@/emails/templates";
import { formatMoney } from "@/lib/money";
import { nextOccurrence, parseRule } from "@/lib/recurrence";
import { getSiteUrl } from "@/lib/site";
import { z } from "@/lib/zod";
import { stringList } from "../content/schemas";
import { readSettingUncached } from "../content/settings-store";
import { getDb } from "../db";
import { clientProjects, clients, invoices, jobs, milestones, reminders, tasks, type ReminderChannel, type Task } from "../db/schema";
import { enqueueJob } from "../jobs/queue";
import { renderMail, sendMailOrQueue } from "../mail/send";
import { writeAudit } from "./audit";
import type { RequestMeta } from "./inbox";
import { pushToAdmins } from "./push";

export class TaskError extends Error {}

export interface Actor extends RequestMeta {
  id: string;
}

const OFFSET = "+02:00";
const TIME_ZONE = "Africa/Lubumbashi";

/** "2026-11-23T09:00" typed in the admin is a Bukavu local time. */
export function parseLocalDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Inverse of parseLocalDateTime, for datetime-local inputs. */
export function toLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date.getTime() + 2 * 3600_000).toISOString().slice(0, 16);
}

/** Start of the current day in Bukavu, as a UTC instant. */
export function startOfLocalDay(now = new Date()): Date {
  const local = new Date(now.getTime() + 2 * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 2 * 3600_000);
}

export const REMINDER_OPTIONS = [
  { value: 0, label: "À l'heure prévue" },
  { value: 15, label: "15 min avant" },
  { value: 60, label: "1 h avant" },
  { value: 180, label: "3 h avant" },
  { value: 1440, label: "1 jour avant" },
  { value: 2880, label: "2 jours avant" },
  { value: 10080, label: "1 semaine avant" },
] as const;

export const taskInputSchema = z.object({
  title: z.string().trim().min(2, "Obligatoire").max(200),
  description: z.string().trim().max(5000).default("").transform((value) => value || null),
  clientProjectId: z
    .string()
    .trim()
    .default("")
    .transform((value) => value || null)
    .pipe(z.uuid().nullable()),
  status: z.enum(["todo", "in_progress", "blocked", "done"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueAt: z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const date = parseLocalDateTime(value);
      if (!date) {
        context.addIssue({ code: "custom", message: "Date invalide" });
        return z.NEVER;
      }
      return date;
    }),
  estimateMinutes: z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number <= 0 || number > 100_000) {
        context.addIssue({ code: "custom", message: "Durée invalide (minutes)" });
        return z.NEVER;
      }
      return number;
    }),
  recurrenceRule: z
    .string()
    .trim()
    .max(200)
    .default("")
    .refine((value) => value === "" || parseRule(value) !== null, "Récurrence invalide")
    .transform((value) => value || null),
  labels: stringList,
  checklist: z
    .array(z.object({ id: z.string().max(64).default(""), label: z.string().trim().max(300).default(""), done: z.boolean().default(false) }))
    .max(50)
    .default([])
    .transform((items) => items.filter((item) => item.label).map((item) => ({ ...item, id: item.id || randomUUID() }))),
  reminderOffsets: z
    .array(z.coerce.number().int().min(0).max(43_200))
    .max(6)
    .default([])
    .transform((values) => [...new Set(values)].sort((a, b) => b - a)),
  reminderChannels: z.array(z.enum(["email", "push"])).max(2).default([]),
});

export type TaskInput = z.infer<typeof taskInputSchema>;

// Reminders

/** Cancels pending reminders of a task and removes their queued jobs. */
async function cancelReminders(taskId: string): Promise<void> {
  const db = getDb();
  const pending = await db
    .update(reminders)
    .set({ status: "cancelled" })
    .where(and(eq(reminders.taskId, taskId), eq(reminders.status, "pending")))
    .returning({ jobId: reminders.jobId });
  const jobIds = pending.map((row) => row.jobId).filter((value): value is string => Boolean(value));
  if (jobIds.length) await db.delete(jobs).where(and(inArray(jobs.id, jobIds), eq(jobs.status, "pending")));
}

/** One reminder and one queued job per offset still in the future. */
export async function scheduleReminders(task: Task, now = new Date()): Promise<number> {
  await cancelReminders(task.id);
  if (!task.dueAt || task.status === "done" || task.deletedAt || task.reminderOffsets.length === 0) return 0;
  const channels: ReminderChannel[] = task.reminderChannels.length ? task.reminderChannels : ["email"];
  let count = 0;
  for (const offset of task.reminderOffsets) {
    const remindAt = new Date(task.dueAt.getTime() - offset * 60_000);
    if (remindAt <= now) continue;
    const [reminder] = await getDb().insert(reminders).values({ taskId: task.id, entityId: task.id, remindAt, channels }).returning({ id: reminders.id });
    const jobId = await enqueueJob("task.reminder", { reminderId: reminder.id }, { runAt: remindAt });
    await getDb().update(reminders).set({ jobId }).where(eq(reminders.id, reminder.id));
    count += 1;
  }
  return count;
}

async function adminEmail(): Promise<string | null> {
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  const issuer = await readSettingUncached("issuer");
  return issuer.email || null;
}

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: TIME_ZONE });

/** Job handler: sends the reminder unless the task was completed or changed since. */
export async function deliverReminder(reminderId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ reminder: reminders, task: tasks })
    .from(reminders)
    .innerJoin(tasks, eq(tasks.id, reminders.taskId))
    .where(eq(reminders.id, reminderId))
    .limit(1);
  if (!row || row.reminder.status !== "pending") return;
  if (row.task.status === "done" || row.task.deletedAt) {
    await db.update(reminders).set({ status: "cancelled" }).where(eq(reminders.id, reminderId));
    return;
  }
  const url = new URL(`/admin/taches/${row.task.id}`, getSiteUrl()).toString();
  const when = row.task.dueAt ? dateTime.format(row.task.dueAt) : "";
  if (row.reminder.channels.includes("email")) {
    const to = await adminEmail();
    if (to) {
      const mail = await renderMail(createElement(TaskReminderEmail, { title: row.task.title, when, description: row.task.description ?? "", url }));
      await sendMailOrQueue({ to, subject: `Rappel : ${row.task.title}`, ...mail });
    }
  }
  if (row.reminder.channels.includes("push")) {
    await pushToAdmins({ title: `Rappel : ${row.task.title}`, body: when ? `Prévu ${when}` : "Tâche à traiter", url, tag: `task-${row.task.id}` });
  }
  await db.update(reminders).set({ status: "sent", sentAt: new Date() }).where(eq(reminders.id, reminderId));
}

// Tasks

export async function saveTask(id: string | null, input: TaskInput, actor: Actor): Promise<string> {
  const db = getDb();
  const completedAt = input.status === "done" ? new Date() : null;
  let task: Task;
  if (id) {
    const [current] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
    if (!current) throw new TaskError("Tâche introuvable.");
    [task] = await db
      .update(tasks)
      .set({ ...input, completedAt: input.status === "done" ? (current.completedAt ?? completedAt) : null })
      .where(eq(tasks.id, id))
      .returning();
    if (input.status === "done" && current.status !== "done") await spawnNextOccurrence(task);
  } else {
    [task] = await db.insert(tasks).values({ ...input, completedAt, createdBy: actor.id }).returning();
  }
  await scheduleReminders(task);
  await writeAudit({ actorId: actor.id, action: id ? "task.update" : "task.create", entityType: "task", entityId: task.id, ip: actor.ip });
  return task.id;
}

/** Recurring task completed: the next occurrence is created with its reminders. */
async function spawnNextOccurrence(task: Task): Promise<string | null> {
  if (!task.recurrenceRule || !task.dueAt) return null;
  const db = getDb();
  const [existing] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.recurrenceParentId, task.id), isNull(tasks.deletedAt))).limit(1);
  if (existing) return existing.id;
  // Skips occurrences already in the past, so a late completion does not create overdue tasks.
  let due = nextOccurrence(task.recurrenceRule, task.dueAt);
  const floor = startOfLocalDay();
  for (let guard = 0; due && due < floor && guard < 400; guard += 1) due = nextOccurrence(task.recurrenceRule, due);
  if (!due) return null;
  const [next] = await db
    .insert(tasks)
    .values({
      title: task.title,
      description: task.description,
      clientProjectId: task.clientProjectId,
      milestoneId: task.milestoneId,
      priority: task.priority,
      dueAt: due,
      estimateMinutes: task.estimateMinutes,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.id,
      labels: task.labels,
      checklist: task.checklist.map((item) => ({ ...item, done: false })),
      reminderOffsets: task.reminderOffsets,
      reminderChannels: task.reminderChannels,
      createdBy: task.createdBy,
    })
    .returning();
  await scheduleReminders(next);
  return next.id;
}

export async function setTaskStatus(id: string, status: Task["status"], actor: Actor): Promise<void> {
  const db = getDb();
  const [current] = await db.select().from(tasks).where(and(eq(tasks.id, id), isNull(tasks.deletedAt))).limit(1);
  if (!current) throw new TaskError("Tâche introuvable.");
  if (current.status === status) return;
  const [task] = await db
    .update(tasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(tasks.id, id))
    .returning();
  if (status === "done") await spawnNextOccurrence(task);
  await scheduleReminders(task);
  await writeAudit({ actorId: actor.id, action: "task.status", entityType: "task", entityId: id, diff: { status }, ip: actor.ip });
}

export async function toggleChecklistItem(taskId: string, itemId: string): Promise<void> {
  const db = getDb();
  const [task] = await db.select({ checklist: tasks.checklist }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
  if (!task) return;
  await db
    .update(tasks)
    .set({ checklist: task.checklist.map((item) => (item.id === itemId ? { ...item, done: !item.done } : item)) })
    .where(eq(tasks.id, taskId));
}

export async function deleteTask(id: string, actor: Actor): Promise<void> {
  await getDb().update(tasks).set({ deletedAt: new Date() }).where(eq(tasks.id, id));
  await cancelReminders(id);
  await writeAudit({ actorId: actor.id, action: "task.delete", entityType: "task", entityId: id, ip: actor.ip });
}

export type TaskRow = Task & { projectName: string | null; clientName: string | null };

const taskColumns = { task: tasks, projectName: clientProjects.name, clientName: clients.name };

function withProject<T extends { task: Task; projectName: string | null; clientName: string | null }>(rows: T[]): TaskRow[] {
  return rows.map(({ task, projectName, clientName }) => ({ ...task, projectName, clientName }));
}

export async function listOpenTasks(): Promise<TaskRow[]> {
  const rows = await getDb()
    .select(taskColumns)
    .from(tasks)
    .leftJoin(clientProjects, eq(clientProjects.id, tasks.clientProjectId))
    .leftJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(and(isNull(tasks.deletedAt), or(ne(tasks.status, "done"), gte(tasks.completedAt, new Date(Date.now() - 14 * 86_400_000)))))
    .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.sortOrder), desc(tasks.createdAt))
    .limit(500);
  return withProject(rows);
}

export async function tasksBetween(from: Date, to: Date): Promise<TaskRow[]> {
  const rows = await getDb()
    .select(taskColumns)
    .from(tasks)
    .leftJoin(clientProjects, eq(clientProjects.id, tasks.clientProjectId))
    .leftJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(and(isNull(tasks.deletedAt), isNotNull(tasks.dueAt), gte(tasks.dueAt, from), lt(tasks.dueAt, to)))
    .orderBy(asc(tasks.dueAt));
  return withProject(rows);
}

export async function getTask(id: string) {
  const [row] = await getDb()
    .select(taskColumns)
    .from(tasks)
    .leftJoin(clientProjects, eq(clientProjects.id, tasks.clientProjectId))
    .leftJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!row) return null;
  const reminderRows = await getDb().select().from(reminders).where(eq(reminders.taskId, id)).orderBy(desc(reminders.remindAt)).limit(20);
  return { task: { ...row.task, projectName: row.projectName, clientName: row.clientName }, reminders: reminderRows };
}

/** Today and overdue counts, for the navigation badge and the dashboard. */
export async function taskCounters(now = new Date()) {
  const endOfDay = new Date(startOfLocalDay(now).getTime() + 86_400_000);
  const [row] = await getDb()
    .select({
      overdue: sql<number>`count(*) filter (where ${tasks.dueAt} < ${now.toISOString()}::timestamptz)::int`,
      today: sql<number>`count(*) filter (where ${tasks.dueAt} >= ${now.toISOString()}::timestamptz and ${tasks.dueAt} < ${endOfDay.toISOString()}::timestamptz)::int`,
    })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), ne(tasks.status, "done")));
  return { overdue: row?.overdue ?? 0, today: row?.today ?? 0 };
}

// Daily digest

export async function digestData(now = new Date()) {
  const db = getDb();
  const start = startOfLocalDay(now);
  const end = new Date(start.getTime() + 86_400_000);
  const today = new Date(start.getTime() + 2 * 3600_000).toISOString().slice(0, 10);
  const inThreeDays = new Date(start.getTime() + 3 * 86_400_000 + 2 * 3600_000).toISOString().slice(0, 10);
  const [dueToday, overdue, milestoneRows, invoiceRows] = await Promise.all([
    db.select().from(tasks).where(and(isNull(tasks.deletedAt), ne(tasks.status, "done"), gte(tasks.dueAt, start), lt(tasks.dueAt, end))).orderBy(asc(tasks.dueAt)),
    db.select().from(tasks).where(and(isNull(tasks.deletedAt), ne(tasks.status, "done"), lt(tasks.dueAt, start))).orderBy(asc(tasks.dueAt)),
    db
      .select({ milestone: milestones, projectName: clientProjects.name })
      .from(milestones)
      .innerJoin(clientProjects, eq(clientProjects.id, milestones.clientProjectId))
      .where(and(inArray(milestones.status, ["pending", "in_progress"]), gte(milestones.dueDate, today), lte(milestones.dueDate, inThreeDays), isNull(clientProjects.deletedAt)))
      .orderBy(asc(milestones.dueDate)),
    db
      .select()
      .from(invoices)
      .where(
        and(
          isNull(invoices.deletedAt),
          or(eq(invoices.status, "overdue"), and(inArray(invoices.status, ["sent", "viewed", "partially_paid"]), lte(invoices.dueDate, inThreeDays))),
        ),
      )
      .orderBy(asc(invoices.dueDate)),
  ]);
  return { dueToday, overdue, milestones: milestoneRows, invoices: invoiceRows };
}

const time = new Intl.DateTimeFormat("fr-FR", { timeStyle: "short", timeZone: TIME_ZONE });
const shortDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: TIME_ZONE });
const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

/** 7:00 digest: today, overdue, upcoming milestones and invoices. Nothing is sent when everything is empty. */
export async function sendDailyDigest(now = new Date()): Promise<number> {
  const data = await digestData(now);
  const sections = [
    { title: "Aujourd'hui", items: data.dueToday.map((task) => `${task.dueAt ? time.format(task.dueAt) : ""} ${task.title}`.trim()) },
    { title: "En retard", items: data.overdue.map((task) => `${task.title} (prévu le ${task.dueAt ? shortDate.format(task.dueAt) : ""})`) },
    { title: "Jalons des 3 prochains jours", items: data.milestones.map(({ milestone, projectName }) => `${projectName} : ${milestone.title} (${milestone.dueDate ? day(milestone.dueDate) : ""})`) },
    {
      title: "Factures à suivre",
      items: data.invoices.map(
        (invoice) => `${invoice.number} ${invoice.recipientName}, ${formatMoney(invoice.balance, invoice.currency)} ${invoice.status === "overdue" ? "en retard" : `échéance ${day(invoice.dueDate)}`}`,
      ),
    },
  ].filter((section) => section.items.length > 0);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);
  if (total === 0) return 0;
  const to = await adminEmail();
  const url = new URL("/admin/taches", getSiteUrl()).toString();
  if (to) {
    const mail = await renderMail(createElement(DigestEmail, { date: dateTime.format(now).split(" à ")[0], sections, url }));
    await sendMailOrQueue({ to, subject: `Votre journée : ${data.dueToday.length} tâche(s), ${data.overdue.length} en retard`, ...mail });
  }
  await pushToAdmins({ title: "Votre journée", body: `${data.dueToday.length} tâche(s) aujourd'hui, ${data.overdue.length} en retard, ${data.invoices.length} facture(s) à suivre.`, url, tag: "digest" });
  return total;
}
