import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { banDuration, invalidateBanCache, ipStatus } from "@/monitoring/bans";
import { HTACCESS_BEGIN, HTACCESS_END, buildHtaccessBlock, replaceManagedBlock } from "@/monitoring/ban-sync";
import { aggregateDay } from "@/monitoring/maintenance";
import { recordSignals, visitorHash } from "@/monitoring/record";
import { inspectRequest } from "@/monitoring/rules";
import { track } from "@/monitoring/transport";
import { closeDb, getDb } from "@/server/db";
import { dailyStats, ipBans, ipReputation, securityEvents, users } from "@/server/db/schema";
import { addToAllowlist, manualBan } from "@/server/services/monitoring";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";

const scanner = { method: "GET", path: "/.env", query: "", userAgent: "Mozilla/5.0", country: "FR" };

describe("ban helpers", () => {
  it("uses progressive durations", () => {
    expect(banDuration(0)).toBe(3600_000);
    expect(banDuration(1)).toBe(86_400_000);
    expect(banDuration(2)).toBe(7 * 86_400_000);
    expect(banDuration(3)).toBeNull();
  });

  it("rewrites only the managed .htaccess block and drops invalid entries", () => {
    const original = "# cPanel Passenger\nPassengerAppRoot /home/x/portfolio\n";
    const block = buildHtaccessBlock(["203.0.113.7", "198.51.100.0/24", "not-an-ip", "1.2.3.4/2"]);
    expect(block).toContain("Require not ip 203.0.113.7");
    expect(block).toContain("Require not ip 198.51.100.0/24");
    expect(block).not.toContain("not-an-ip");
    expect(block).not.toContain("1.2.3.4/2");
    const once = replaceManagedBlock(original, block);
    expect(once.startsWith(original)).toBe(true);
    const twice = replaceManagedBlock(once, buildHtaccessBlock([]));
    expect(twice).toContain("PassengerAppRoot");
    expect(twice).not.toContain("203.0.113.7");
    expect(twice.split(HTACCESS_BEGIN)).toHaveLength(2);
    expect(twice).toContain(HTACCESS_END);
  });

  it("hashes visitors without keeping the IP", () => {
    const day = new Date("2026-11-21T10:00:00Z");
    const hash = visitorHash("203.0.113.9", "UA", day);
    expect(hash).not.toContain("203");
    expect(visitorHash("203.0.113.9", "UA", day)).toBe(hash);
    expect(visitorHash("203.0.113.9", "UA", new Date("2026-11-22T10:00:00Z"))).not.toBe(hash);
  });
});

describe.skipIf(!hasTestDatabase)("security monitoring", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    invalidateBanCache();
  });
  afterAll(closeDb);

  it("logs a .env probe as path_scan and bans after repeated attempts", async () => {
    const ip = "203.0.113.77";
    const detections = inspectRequest({ method: "GET", path: "/.env", search: "", userAgent: "Mozilla/5.0" });
    expect(await recordSignals({ ip, ...scanner }, detections)).toBe("logged");
    const events = await getDb().select().from(securityEvents).where(eq(securityEvents.ip, ip));
    expect(events.map((event) => event.category).sort()).toEqual(["honeypot", "path_scan"]);
    expect(events[0].method).toBe("GET");

    expect(await recordSignals({ ip, ...scanner }, detections)).toBe("banned");
    invalidateBanCache();
    expect((await ipStatus(ip)).banned).toBe(true);
    const [ban] = await getDb().select().from(ipBans).where(eq(ipBans.ipOrCidr, ip));
    expect(ban.source).toBe("auto");
    expect(Math.abs(ban.expiresAt!.getTime() - ban.bannedAt.getTime() - 3600_000)).toBeLessThan(2000);
    const [reputation] = await getDb().select().from(ipReputation).where(eq(ipReputation.ip, ip));
    expect(reputation.bansCount).toBe(1);
  });

  it("never bans allowlisted addresses, the unknown IP or CIDR ranges given in the allowlist", async () => {
    const [user] = await getDb().insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
    const actor = { id: user.id, ip: "198.51.100.1", userAgent: "vitest" };
    await addToAllowlist("198.51.100.0/24", "Bureau", actor);
    invalidateBanCache();
    const detections = inspectRequest({ method: "GET", path: "/.env", search: "", userAgent: "x" });
    for (let index = 0; index < 4; index += 1) await recordSignals({ ip: "198.51.100.20", ...scanner }, detections);
    for (let index = 0; index < 4; index += 1) await recordSignals({ ip: "0.0.0.0", ...scanner }, detections);
    invalidateBanCache();
    expect((await ipStatus("198.51.100.20")).banned).toBe(false);
    expect((await ipStatus("0.0.0.0")).banned).toBe(false);
    expect(await getDb().select().from(ipBans)).toHaveLength(0);
    await expect(manualBan({ ipOrCidr: "198.51.100.0/24", reason: "test", hours: 1 }, actor)).rejects.toThrow(/liste blanche/);
    await expect(manualBan({ ipOrCidr: "198.51.100.1", reason: "test", hours: 1 }, actor)).rejects.toThrow();
    await expect(manualBan({ ipOrCidr: "nope", reason: "test", hours: 1 }, actor)).rejects.toThrow(/invalide/);
  });

  it("bans ranges manually and aggregates the audience by day", async () => {
    const [user] = await getDb().insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
    await manualBan({ ipOrCidr: "192.0.2.0/24", reason: "Réseau hostile", hours: null }, { id: user.id, ip: "198.51.100.1", userAgent: "vitest" });
    invalidateBanCache();
    expect((await ipStatus("192.0.2.200")).banned).toBe(true);

    const at = new Date("2026-11-20T10:00:00+02:00");
    await track(
      { type: "page_view", data: { path: "/", visitorHash: "a", device: "mobile", createdAt: at } },
      { type: "page_view", data: { path: "/", visitorHash: "a", device: "mobile", createdAt: at } },
      { type: "page_view", data: { path: "/blog", visitorHash: "b", device: "desktop", country: "CD", createdAt: at } },
      { type: "analytics_event", data: { name: "quote_submit", visitorHash: "b", createdAt: at } },
    );
    expect(await aggregateDay("2026-11-20")).toBeGreaterThan(0);
    const stats = await getDb().select().from(dailyStats).where(eq(dailyStats.day, "2026-11-20"));
    const value = (metric: string, dimension = "") => stats.find((row) => row.metric === metric && row.dimension === dimension)?.value;
    expect(value("views")).toBe(3);
    expect(value("visitors")).toBe(2);
    expect(value("path", "/")).toBe(2);
    expect(value("country", "CD")).toBe(1);
    expect(value("event", "quote_submit")).toBe(1);
  });
});
