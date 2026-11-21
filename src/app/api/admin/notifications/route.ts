import { getSiteUrl } from "@/lib/site";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { listNotifications, markNotificationsRead } from "@/server/services/notifications";

async function admin() {
  try {
    return await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

/** Latest notifications of the signed in administrator, with the unread count. */
export async function GET() {
  const session = await admin();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const { rows, unread } = await listNotifications(session.user.id);
  return Response.json(
    {
      unread,
      items: rows.map((row) => ({ id: row.id, type: row.type, title: row.title, body: row.body, url: row.url, read: Boolean(row.readAt), createdAt: row.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Marks some notifications (ids) or all of them as read. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || (origin !== new URL(getSiteUrl()).origin && origin !== new URL(request.url).origin)) {
    return Response.json({ error: "Origine refusée" }, { status: 403 });
  }
  const session = await admin();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100) : undefined;
  await markNotificationsRead(session.user.id, ids);
  return Response.json({ ok: true });
}
