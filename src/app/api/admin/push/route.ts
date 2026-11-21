import { AuthError, requireAdmin } from "@/server/auth/guards";
import { getSiteUrl } from "@/lib/site";
import { pushConfig, removeSubscription, saveSubscription, subscriptionSchema } from "@/server/services/push";

/** Route handlers that change data check the Origin header (CSRF). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(getSiteUrl()).origin || origin === new URL(request.url).origin;
}

async function admin() {
  try {
    return await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return null;
    throw error;
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
  const session = await admin();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  if (!pushConfig()) return Response.json({ error: "Notifications non configurées (clés VAPID absentes)." }, { status: 503 });
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Abonnement invalide" }, { status: 400 });
  await saveSubscription(session.user.id, parsed.data, request.headers.get("user-agent"));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine refusée" }, { status: 403 });
  const session = await admin();
  if (!session) return Response.json({ error: "Non autorisé" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (typeof body?.endpoint === "string") await removeSubscription(session.user.id, body.endpoint);
  return Response.json({ ok: true });
}
