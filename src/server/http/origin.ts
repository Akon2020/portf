import { getSiteUrl } from "@/lib/site";

/**
 * CSRF protection for route handlers that change data: the Origin header must
 * match the site URL or the host the request was sent to.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }
  if (originUrl.origin === getSiteUrl().origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return !!host && originUrl.host === host;
}
