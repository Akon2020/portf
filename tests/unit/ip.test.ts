import { describe, expect, it } from "vitest";
import { UNKNOWN_IP, getClientIp, normalizeIp } from "@/lib/ip";

const headers = (values: Record<string, string>) => new Headers(values);

describe("normalizeIp", () => {
  it("cleans common formats", () => {
    expect(normalizeIp("::ffff:10.0.0.1")).toBe("10.0.0.1");
    expect(normalizeIp("10.0.0.1:443")).toBe("10.0.0.1");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("not an ip")).toBeNull();
  });
});

describe("getClientIp", () => {
  it("ignores forwarding headers without TRUST_PROXY", () => {
    const h = headers({ "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(h, { trustProxy: false })).toBe(UNKNOWN_IP);
    expect(getClientIp(h, { trustProxy: false, remoteAddress: "5.6.7.8" })).toBe("5.6.7.8");
  });

  it("uses the right most forwarded entry, which a client cannot forge", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 41.243.10.20" });
    expect(getClientIp(h, { trustProxy: true })).toBe("41.243.10.20");
  });

  it("trusts CF-Connecting-IP only behind a Cloudflare edge", () => {
    const viaCloudflare = headers({
      "x-forwarded-for": "41.243.10.20, 172.68.10.1",
      "cf-connecting-ip": "41.243.10.20",
    });
    expect(getClientIp(viaCloudflare, { trustProxy: true })).toBe("41.243.10.20");

    const spoofed = headers({ "x-forwarded-for": "8.8.4.4", "cf-connecting-ip": "1.1.1.1" });
    expect(getClientIp(spoofed, { trustProxy: true })).toBe("8.8.4.4");
  });
});
