/** Content Security Policy and security headers shared by the proxy and next.config. */

export const PRIVATE_PREFIXES = ["/admin", "/auth", "/espace-client", "/f/"] as const;

export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

/** Remote image hosts still used by the current content, removed once migrated. */
const LEGACY_IMAGE_HOSTS = [
  "https://hebbkx1anhila5yf.public.blob.vercel-storage.com",
  "https://images.unsplash.com",
];

const TURNSTILE = "https://challenges.cloudflare.com";

export interface CspOptions {
  /** Per request nonce. Only dynamic pages can use one. */
  nonce?: string;
  dev?: boolean;
}

/**
 * Private areas (admin, client portal, documents) are dynamic and get a strict
 * nonce based policy. Public pages are statically generated, so they cannot
 * carry a nonce: inline scripts are allowed there but everything else stays
 * locked to the site origin.
 */
export function buildCsp({ nonce, dev = false }: CspOptions): string {
  const scriptSrc = ["'self'"];
  if (nonce) scriptSrc.push(`'nonce-${nonce}'`, "'strict-dynamic'");
  else scriptSrc.push("'unsafe-inline'");
  if (dev) scriptSrc.push("'unsafe-eval'");
  // Cloudflare Turnstile on public forms.
  scriptSrc.push(TURNSTILE);

  const connectSrc = ["'self'", TURNSTILE];
  if (dev) connectSrc.push("ws:", "wss:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": scriptSrc,
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", ...LEGACY_IMAGE_HOSTS],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "frame-src": ["'self'", TURNSTILE],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers applied to every response, static files included. */
export function baseSecurityHeaders(dev = false): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
  ];
  if (!dev) {
    headers.push({ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" });
  }
  return headers;
}
