import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import { notifications, users } from "../db/schema";

export type NotificationType =
  | "message"
  | "quote_request"
  | "quote_negotiation"
  | "quote_accepted"
  | "quote_declined"
  | "portal_message"
  | "payment"
  | "task_reminder"
  | "security";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  /** Internal admin path opened from the notification. */
  url?: string | null;
}

/** One unread notification per active administrator. Never throws: notifying must not break the action. */
export async function notifyAdmins(input: NotificationInput): Promise<number> {
  try {
    const db = getDb();
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.role, ["super_admin", "editor"]), eq(users.isActive, true), isNull(users.deletedAt)));
    if (admins.length === 0) return 0;
    await db.insert(notifications).values(
      admins.map((admin) => ({
        userId: admin.id,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 500) ?? null,
        url: input.url && input.url.startsWith("/admin") ? input.url : null,
      })),
    );
    return admins.length;
  } catch (error) {
    console.error("[notifications] insert failed", error instanceof Error ? error.message : error);
    return 0;
  }
}

export async function listNotifications(userId: string, limit = 30) {
  const db = getDb();
  const [rows, [{ unread }]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  return { rows, unread };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt), ids?.length ? inArray(notifications.id, ids) : undefined));
}

/** Nightly: read notifications older than 90 days are removed. */
export async function purgeNotifications(): Promise<number> {
  const rows = await getDb()
    .delete(notifications)
    .where(lt(notifications.createdAt, new Date(Date.now() - 90 * 86_400_000)))
    .returning({ id: notifications.id });
  return rows.length;
}
