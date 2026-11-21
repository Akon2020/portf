/**
 * IP bans and allowlist. The state lives in PostgreSQL (several Passenger
 * processes); each process keeps an in-memory copy refreshed every 30 s.
 */
import { BlockList, isIP } from "node:net";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ipAllowlist, ipBans, ipReputation } from "@/server/db/schema";

const REFRESH_MS = 30_000;
// Loopback, and the placeholder used when the client IP is unknown (never ban everyone).
const ALWAYS_ALLOWED = ["127.0.0.1", "::1", "0.0.0.0"];

export function isValidIpOrCidr(value: string): boolean {
  const [address, prefix] = value.trim().split("/");
  const family = isIP(address);
  if (!family) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return Number.isInteger(bits) && bits >= (family === 4 ? 8 : 16) && bits <= (family === 4 ? 32 : 128);
}

function addToList(list: BlockList, value: string): void {
  const [address, prefix] = value.split("/");
  const family = isIP(address) === 6 ? "ipv6" : "ipv4";
  if (!isIP(address)) return;
  if (prefix === undefined) list.addAddress(address, family);
  else list.addSubnet(address, Number(prefix), family);
}

function check(list: BlockList, ip: string): boolean {
  const family = isIP(ip);
  if (!family) return false;
  return list.check(ip, family === 6 ? "ipv6" : "ipv4");
}

interface Snapshot {
  bans: BlockList;
  allow: BlockList;
  loadedAt: number;
}

let snapshot: Snapshot | null = null;
let loading: Promise<Snapshot> | null = null;

export function activeBanCondition() {
  return and(isNull(ipBans.liftedAt), or(isNull(ipBans.expiresAt), gt(ipBans.expiresAt, new Date())));
}

async function load(): Promise<Snapshot> {
  const db = getDb();
  const [bans, allowed] = await Promise.all([
    db.select({ ip: ipBans.ipOrCidr }).from(ipBans).where(activeBanCondition()),
    db.select({ ip: ipAllowlist.ipOrCidr }).from(ipAllowlist),
  ]);
  const banList = new BlockList();
  const allowList = new BlockList();
  for (const row of bans) addToList(banList, row.ip);
  for (const value of [...ALWAYS_ALLOWED, ...(process.env.IP_ALLOWLIST ?? "").split(",").map((item) => item.trim()).filter(Boolean), ...allowed.map((row) => row.ip)]) {
    addToList(allowList, value);
  }
  return { bans: banList, allow: allowList, loadedAt: Date.now() };
}

async function current(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.loadedAt < REFRESH_MS) return snapshot;
  loading ??= load()
    .then((value) => {
      snapshot = value;
      return value;
    })
    .finally(() => {
      loading = null;
    });
  // A snapshot that simply aged keeps serving while the refresh runs;
  // an invalidated one (ban or lift just made) waits for fresh data.
  return snapshot && snapshot.loadedAt !== 0 ? snapshot : loading;
}

/** Forces a reload on the next check, after a manual ban or lift in this process. */
export function invalidateBanCache(): void {
  if (snapshot) snapshot.loadedAt = 0;
}

export async function ipStatus(ip: string): Promise<{ banned: boolean; allowed: boolean }> {
  try {
    const state = await current();
    const allowed = check(state.allow, ip);
    return { allowed, banned: !allowed && check(state.bans, ip) };
  } catch (error) {
    // The site keeps working when the database is unreachable.
    console.error("[monitoring] ban check failed", error instanceof Error ? error.message : error);
    return { banned: false, allowed: false };
  }
}

/** Progressive durations: 1 h, 24 h, 7 days, then permanent. */
export function banDuration(previousBans: number): number | null {
  const steps = [3600_000, 86_400_000, 7 * 86_400_000];
  return previousBans < steps.length ? steps[previousBans] : null;
}

export async function banIp(input: { ipOrCidr: string; reason: string; source: "auto" | "manual"; ruleId?: string | null; durationMs?: number | null; createdBy?: string | null }) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(ipBans)
    .where(and(eq(ipBans.ipOrCidr, input.ipOrCidr), activeBanCondition()))
    .orderBy(desc(ipBans.bannedAt))
    .limit(1);
  if (existing) return existing;
  const [ban] = await db
    .insert(ipBans)
    .values({
      ipOrCidr: input.ipOrCidr,
      reason: input.reason.slice(0, 500),
      source: input.source,
      ruleId: input.ruleId ?? null,
      expiresAt: input.durationMs ? new Date(Date.now() + input.durationMs) : null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  if (!input.ipOrCidr.includes("/")) {
    await db
      .insert(ipReputation)
      .values({ ip: input.ipOrCidr, bansCount: 1 })
      .onConflictDoUpdate({ target: ipReputation.ip, set: { bansCount: sql`${ipReputation.bansCount} + 1` } });
  }
  invalidateBanCache();
  return ban;
}

export async function liftBan(id: string): Promise<void> {
  await getDb().update(ipBans).set({ liftedAt: new Date() }).where(eq(ipBans.id, id));
  invalidateBanCache();
}

export async function countBanHit(ip: string): Promise<void> {
  await getDb()
    .update(ipBans)
    .set({ hitCount: sql`${ipBans.hitCount} + 1` })
    .where(and(eq(ipBans.ipOrCidr, ip), activeBanCondition()));
}
