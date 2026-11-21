/**
 * Runs in the proxy on every request: ban check, attack detection and the
 * server side audience tracking. Database writes never delay the response.
 */
import type { NextRequest } from "next/server";
import { getClientIp } from "@/lib/ip";
import { isPrivatePath } from "@/lib/security-headers";
import { readSettingUncached } from "@/server/content/settings-store";
import { countBanHit, ipStatus } from "./bans";
import { recordSignals, visitorHash } from "./record";
import { inspectRequest, isKnownBot, type Detection } from "./rules";
import { trackInBackground } from "./transport";
import { browserOf, deviceOf, osOf } from "./user-agent";

const BLOCKING = new Set(["sqli", "xss", "path_traversal", "cmd_injection"]);

function country(request: NextRequest): string | null {
  const value = request.headers.get("cf-ipcountry");
  return value && /^[A-Z]{2}$/.test(value) && value !== "XX" ? value : null;
}

let settingsCache: { trackAudience: boolean; loadedAt: number } | null = null;

async function audienceEnabled(): Promise<boolean> {
  if (settingsCache && Date.now() - settingsCache.loadedAt < 60_000) return settingsCache.trackAudience;
  try {
    const settings = await readSettingUncached("security");
    settingsCache = { trackAudience: settings.trackAudience, loadedAt: Date.now() };
  } catch {
    settingsCache = { trackAudience: false, loadedAt: Date.now() };
  }
  return settingsCache.trackAudience;
}

function background(task: Promise<unknown>): void {
  task.catch((error) => console.error("[monitoring]", error instanceof Error ? error.message : error));
}

/** Returns a response to send instead of the page, or null to continue. */
export async function guardRequest(request: NextRequest): Promise<Response | null> {
  const { pathname, search } = request.nextUrl;
  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  const status = await ipStatus(ip);

  if (status.banned) {
    background(countBanHit(ip));
    return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  const detections: Detection[] = inspectRequest({ method: request.method, path: pathname, search, userAgent });
  if (detections.length > 0) {
    const block = !status.allowed && detections.some((detection) => BLOCKING.has(detection.category) && (detection.severity === "high" || detection.severity === "critical"));
    const trap = detections.some((detection) => detection.category === "honeypot" || detection.category === "path_scan");
    background(recordSignals({ ip, method: request.method, path: pathname, query: search, userAgent, country: country(request) }, detections, block ? "blocked" : "logged"));
    if (block) return new Response("Forbidden", { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    // Scanned paths get a short neutral answer instead of a full page.
    if (trap) return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  // Audience: public pages only, real navigations, no bots, no allowlisted IP (Isaac).
  const isPage = request.method === "GET" && (request.headers.get("sec-fetch-dest") === "document" || request.headers.has("rsc") || (request.headers.get("accept") ?? "").includes("text/html"));
  if (isPage && !status.allowed && !isPrivatePath(pathname) && !pathname.startsWith("/api") && !pathname.startsWith("/media") && !isKnownBot(userAgent) && (await audienceEnabled())) {
    const params = request.nextUrl.searchParams;
    const referrer = request.headers.get("referer");
    let external: string | null = null;
    try {
      external = referrer && new URL(referrer).host !== request.nextUrl.host ? new URL(referrer).host.slice(0, 200) : null;
    } catch {
      external = null;
    }
    const ua = userAgent ?? "";
    trackInBackground({
      type: "page_view",
      data: {
        path: pathname.slice(0, 300),
        locale: pathname === "/en" || pathname.startsWith("/en/") ? "en" : "fr",
        referrer: external,
        utmSource: params.get("utm_source")?.slice(0, 100) ?? null,
        utmMedium: params.get("utm_medium")?.slice(0, 100) ?? null,
        utmCampaign: params.get("utm_campaign")?.slice(0, 100) ?? null,
        country: country(request),
        device: deviceOf(ua),
        browser: browserOf(ua),
        os: osOf(ua),
        visitorHash: visitorHash(ip, ua),
      },
    });
  }
  return null;
}
