import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { buildCsp, isPrivatePath } from "@/lib/security-headers";
import { SESSION_COOKIES } from "@/server/auth/cookie-names";

const dev = process.env.NODE_ENV === "development";
const intl = createIntlMiddleware(routing);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPrivate = isPrivatePath(pathname);

  // Lightweight check only: every protected page validates the session in the database.
  if (pathname.startsWith("/admin") && !request.cookies.has(SESSION_COOKIES.admin)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const portalPublic = pathname === "/espace-client/connexion" || pathname === "/espace-client/verifier";
  if (pathname.startsWith("/espace-client") && !portalPublic && !request.cookies.has(SESSION_COOKIES.client)) {
    const url = request.nextUrl.clone();
    url.pathname = "/espace-client/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isPrivate) {
    // Private areas are dynamic: strict CSP with a per request nonce.
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = buildCsp({ nonce, dev });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  // Public site: locale routing (French without prefix, English under /en).
  const response = intl(request);
  response.headers.set("Content-Security-Policy", buildCsp({ dev }));
  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!api|media|_next/static|_next/image|favicon.ico|icon|apple-icon|robots.txt|sitemap.xml|feed.xml|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|txt|xml|pdf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
