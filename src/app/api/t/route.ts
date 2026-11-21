import { getClientIp } from "@/lib/ip";
import { ipStatus } from "@/monitoring/bans";
import { visitorHash } from "@/monitoring/record";
import { isKnownBot } from "@/monitoring/rules";
import { track } from "@/monitoring/transport";
import { consumeRateLimit } from "@/server/auth/rate-limit";

const EVENTS = new Set(["cta_click", "outbound_click", "cv_download", "engaged_time", "share_click", "whatsapp_click", "calendly_click"]);

/** Visitor events sent with navigator.sendBeacon. Always answers 204, invalid input is ignored. */
export async function POST(request: Request) {
  const done = () => new Response(null, { status: 204 });
  const userAgent = request.headers.get("user-agent");
  if (isKnownBot(userAgent)) return done();
  const text = await request.text().catch(() => "");
  if (text.length > 2000) return done();
  let body: { name?: unknown; path?: unknown; props?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return done();
  }
  if (typeof body.name !== "string" || !EVENTS.has(body.name)) return done();
  const ip = getClientIp(request.headers);
  const status = await ipStatus(ip);
  if (status.allowed && ip !== "0.0.0.0") return done();
  const limit = await consumeRateLimit(`beacon:${ip}`, { limit: 120, windowSeconds: 600 });
  if (!limit.allowed) return done();

  const props: Record<string, string | number | boolean> = {};
  if (body.props && typeof body.props === "object") {
    for (const [key, value] of Object.entries(body.props as Record<string, unknown>).slice(0, 8)) {
      if (!/^[a-z_]{1,30}$/i.test(key)) continue;
      if (typeof value === "string") props[key] = value.slice(0, 200);
      else if (typeof value === "number" && Number.isFinite(value)) props[key] = Math.round(value);
      else if (typeof value === "boolean") props[key] = value;
    }
  }
  await track({
    type: "analytics_event",
    data: {
      name: body.name,
      props,
      path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
      visitorHash: visitorHash(ip, userAgent ?? ""),
    },
  });
  return done();
}
