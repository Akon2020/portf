import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { jobs, reminders, tasks, users } from "@/server/db/schema";
import {
  deliverReminder,
  parseLocalDateTime,
  saveTask,
  sendDailyDigest,
  setTaskStatus,
  taskCounters,
  taskInputSchema,
  toLocalInput,
} from "@/server/services/tasks";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.60", userAgent: "vitest" };

async function actor() {
  const [user] = await getDb().insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
  return { id: user.id, ...meta };
}

const inDays = (days: number, hour = "09:00") => {
  const date = new Date(Date.now() + days * 86_400_000 + 2 * 3600_000).toISOString().slice(0, 10);
  return `${date}T${hour}`;
};

const input = (overrides: Record<string, unknown> = {}) =>
  taskInputSchema.parse({ title: "Relancer le client", status: "todo", priority: "high", dueAt: inDays(3), reminderOffsets: ["1440", "60"], reminderChannels: ["email"], ...overrides });

describe("local dates", () => {
  it("reads datetime-local values as Bukavu time", () => {
    expect(parseLocalDateTime("2026-11-23T09:00")?.toISOString()).toBe("2026-11-23T07:00:00.000Z");
    expect(toLocalInput(new Date("2026-11-23T07:00:00Z"))).toBe("2026-11-23T09:00");
    expect(parseLocalDateTime("23/11/2026")).toBeNull();
  });
});

describe.skipIf(!hasTestDatabase)("tasks and reminders", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("schedules one reminder job per future offset and reschedules on change", async () => {
    const user = await actor();
    const id = await saveTask(null, input(), user);
    let pending = await getDb().select().from(reminders).where(and(eq(reminders.taskId, id), eq(reminders.status, "pending")));
    expect(pending).toHaveLength(2);
    expect(await getDb().select().from(jobs).where(eq(jobs.type, "task.reminder"))).toHaveLength(2);

    await saveTask(id, input({ dueAt: inDays(5), reminderOffsets: ["60"] }), user);
    pending = await getDb().select().from(reminders).where(and(eq(reminders.taskId, id), eq(reminders.status, "pending")));
    expect(pending).toHaveLength(1);
    expect(await getDb().select().from(jobs).where(eq(jobs.type, "task.reminder"))).toHaveLength(1);

    await deliverReminder(pending[0].id);
    const [mail] = await readOutbox();
    expect(mail).toContain("Rappel");
    const [sent] = await getDb().select().from(reminders).where(eq(reminders.id, pending[0].id));
    expect(sent.status).toBe("sent");
  });

  it("skips reminders of completed tasks", async () => {
    const user = await actor();
    const id = await saveTask(null, input(), user);
    const [reminder] = await getDb().select().from(reminders).where(eq(reminders.taskId, id));
    await setTaskStatus(id, "done", user);
    await deliverReminder(reminder.id);
    expect(await readOutbox()).toHaveLength(0);
  });

  it("creates the next occurrence when a recurring task is completed", async () => {
    const user = await actor();
    const id = await saveTask(null, input({ recurrenceRule: "FREQ=WEEKLY", checklist: [{ label: "Préparer", done: true }] }), user);
    await setTaskStatus(id, "done", user);
    await setTaskStatus(id, "in_progress", user);
    await setTaskStatus(id, "done", user);
    const next = await getDb().select().from(tasks).where(and(eq(tasks.recurrenceParentId, id), isNull(tasks.deletedAt)));
    expect(next).toHaveLength(1);
    const [original] = await getDb().select().from(tasks).where(eq(tasks.id, id));
    expect(next[0].dueAt!.getTime() - original.dueAt!.getTime()).toBe(7 * 86_400_000);
    expect(next[0].checklist[0].done).toBe(false);
    expect(next[0].status).toBe("todo");
  });

  it("counts and sends the daily digest only when there is something to say", async () => {
    const user = await actor();
    expect(await sendDailyDigest()).toBe(0);
    await saveTask(null, input({ title: "Tâche en retard", dueAt: inDays(-2), reminderOffsets: [] }), user);
    await saveTask(null, input({ title: "Tâche du jour", dueAt: inDays(0, "23:30"), reminderOffsets: [] }), user);
    const counters = await taskCounters();
    expect(counters.overdue).toBe(1);
    expect(await sendDailyDigest()).toBe(2);
    const [mail] = await readOutbox();
    expect(mail).toContain("Votre journ");
  });
});
