import { BlockList, isIP } from "node:net";

/**
 * Cloudflare edge ranges (https://www.cloudflare.com/ips/).
 * Embedded as a fallback, refreshed weekly by the cron job.
 */
export const CLOUDFLARE_IPV4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];

export const CLOUDFLARE_IPV6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

export function buildBlockList(cidrs: string[]): BlockList {
  const list = new BlockList();
  for (const cidr of cidrs) {
    const [address, prefix] = cidr.split("/");
    const family = isIP(address) === 6 ? "ipv6" : "ipv4";
    if (prefix === undefined) list.addAddress(address, family);
    else list.addSubnet(address, Number(prefix), family);
  }
  return list;
}

let cloudflareList = buildBlockList([...CLOUDFLARE_IPV4, ...CLOUDFLARE_IPV6]);

export function setCloudflareRanges(cidrs: string[]): void {
  if (cidrs.length > 0) cloudflareList = buildBlockList(cidrs);
}

/** Strips ports, brackets and the IPv4 mapped IPv6 prefix. Returns null when invalid. */
export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (value.startsWith("[")) value = value.slice(1, value.indexOf("]"));
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(value)) value = value.split(":")[0];
  if (value.toLowerCase().startsWith("::ffff:") && isIP(value.slice(7)) === 4) value = value.slice(7);
  return isIP(value) ? value.toLowerCase() : null;
}

export function ipInList(ip: string, list: BlockList): boolean {
  const family = isIP(ip) === 6 ? "ipv6" : "ipv4";
  return list.check(ip, family);
}

export function isCloudflareIp(ip: string): boolean {
  return ipInList(ip, cloudflareList);
}

type HeaderSource = Pick<Headers, "get">;

export interface ClientIpOptions {
  trustProxy?: boolean;
  /** Address of the TCP peer when known (Node request socket). */
  remoteAddress?: string | null;
}

export const UNKNOWN_IP = "0.0.0.0";

/**
 * Single source of truth for the client IP.
 * - Without TRUST_PROXY: the socket address only.
 * - With TRUST_PROXY: the right most X-Forwarded-For entry is the peer seen by
 *   our own proxy (Apache, Passenger), left side entries can be forged.
 *   When that peer is a Cloudflare edge, CF-Connecting-IP is trusted.
 */
export function getClientIp(headers: HeaderSource, options: ClientIpOptions = {}): string {
  const trustProxy = options.trustProxy ?? process.env.TRUST_PROXY === "true";
  const socketIp = normalizeIp(options.remoteAddress);
  if (!trustProxy) return socketIp ?? UNKNOWN_IP;

  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter((part): part is string => part !== null);
  const peer = forwarded.at(-1) ?? normalizeIp(headers.get("x-real-ip")) ?? socketIp;

  if (peer && isCloudflareIp(peer)) {
    const cfIp = normalizeIp(headers.get("cf-connecting-ip"));
    if (cfIp) return cfIp;
  }
  return peer ?? UNKNOWN_IP;
}
