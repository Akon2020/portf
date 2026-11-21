import { and, eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { z } from "@/lib/zod";
import { getDb } from "../db";
import { pushSubscriptions, users } from "../db/schema";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Web Push is enabled only when the three VAPID variables are set. */
export function pushConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  return webpush.generateVAPIDKeys();
}

export const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((value) => value.startsWith("https://"), "HTTPS requis"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

export async function saveSubscription(userId: string, input: z.infer<typeof subscriptionSchema>, userAgent: string | null): Promise<void> {
  await getDb()
    .insert(pushSubscriptions)
    .values({ userId, endpoint: input.endpoint, keys: input.keys, userAgent: userAgent?.slice(0, 300) ?? null })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, keys: input.keys, userAgent: userAgent?.slice(0, 300) ?? null } });
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await getDb().delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/**
 * Sends a notification to every device of the given users. Subscriptions the
 * push service reports as gone (404, 410) are removed.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<number> {
  const config = pushConfig();
  if (!config || userIds.length === 0) return 0;
  const db = getDb();
  const rows = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  let delivered = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, JSON.stringify(payload), {
        vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
        TTL: 60 * 60 * 12,
        urgency: "normal",
      });
      delivered += 1;
      await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.id, row.id));
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id));
      else console.error("[push] delivery failed", status ?? error);
    }
  }
  return delivered;
}

/** Notifies every active administrator. */
export async function pushToAdmins(payload: PushPayload): Promise<number> {
  const admins = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.role, ["super_admin", "editor"]), eq(users.isActive, true)));
  return sendPush(
    admins.map((admin) => admin.id),
    payload,
  );
}
