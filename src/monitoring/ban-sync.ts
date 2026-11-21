/**
 * Optional upstream blocking, chosen by BAN_SYNC:
 * - cloudflare: IP access rules through the API (token limited to the zone);
 * - htaccess: a managed block between two markers, the rest of the file untouched.
 * The application 403 stays active in every case.
 */
import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import { and, desc, eq, isNotNull, isNull, or, lte } from "drizzle-orm";
import { getDb } from "@/server/db";
import { ipBans } from "@/server/db/schema";
import { activeBanCondition, isValidIpOrCidr } from "./bans";

export const HTACCESS_BEGIN = "# BEGIN portfolio-bans";
export const HTACCESS_END = "# END portfolio-bans";
const HTACCESS_MAX = 500;

/** Builds the managed block. Only validated addresses reach the file. */
export function buildHtaccessBlock(entries: string[]): string {
  const valid = [...new Set(entries.filter(isValidIpOrCidr))].slice(0, HTACCESS_MAX);
  if (valid.length === 0) return `${HTACCESS_BEGIN}\n${HTACCESS_END}`;
  return [
    HTACCESS_BEGIN,
    "<IfModule mod_authz_core.c>",
    "  <RequireAll>",
    "    Require all granted",
    ...valid.map((entry) => `    Require not ip ${entry}`),
    "  </RequireAll>",
    "</IfModule>",
    HTACCESS_END,
  ].join("\n");
}

/** Replaces (or appends) the managed block and keeps everything else as is. */
export function replaceManagedBlock(content: string, block: string): string {
  const start = content.indexOf(HTACCESS_BEGIN);
  const end = content.indexOf(HTACCESS_END);
  if (start !== -1 && end > start) return `${content.slice(0, start)}${block}${content.slice(end + HTACCESS_END.length)}`;
  const separator = content.length === 0 || content.endsWith("\n") ? "" : "\n";
  return `${content}${separator}\n${block}\n`;
}

async function syncHtaccess(): Promise<number> {
  const path = process.env.HTACCESS_PATH;
  if (!path) throw new Error("HTACCESS_PATH manquant");
  const rows = await getDb().select({ ip: ipBans.ipOrCidr }).from(ipBans).where(activeBanCondition()).orderBy(desc(ipBans.bannedAt)).limit(HTACCESS_MAX);
  const current = await readFile(path, "utf8").catch(() => "");
  const next = replaceManagedBlock(current, buildHtaccessBlock(rows.map((row) => row.ip)));
  if (next === current) return 0;
  // Backup, then atomic replacement so Apache never reads a half written file.
  if (current) await copyFile(path, `${path}.portfolio-backup`);
  await writeFile(`${path}.portfolio-tmp`, next, { mode: 0o644 });
  await rename(`${path}.portfolio-tmp`, path);
  return rows.length;
}

async function cloudflare(path: string, init: RequestInit = {}) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zone) throw new Error("CLOUDFLARE_API_TOKEN ou CLOUDFLARE_ZONE_ID manquant");
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean; result?: { id?: string }; errors?: { message?: string }[] };
  if (!response.ok || !json.success) throw new Error(`Cloudflare : ${json.errors?.[0]?.message ?? response.status}`);
  return json;
}

async function syncCloudflare(): Promise<number> {
  const db = getDb();
  let changes = 0;
  const toCreate = await db.select().from(ipBans).where(and(activeBanCondition(), isNull(ipBans.externalId))).limit(50);
  for (const ban of toCreate) {
    const target = ban.ipOrCidr.includes("/") ? "ip_range" : ban.ipOrCidr.includes(":") ? "ip6" : "ip";
    const json = await cloudflare("", {
      method: "POST",
      body: JSON.stringify({ mode: "block", configuration: { target, value: ban.ipOrCidr }, notes: `portfolio: ${ban.reason}`.slice(0, 200) }),
    });
    await db.update(ipBans).set({ externalId: json.result?.id ?? null, syncedAt: new Date() }).where(eq(ipBans.id, ban.id));
    changes += 1;
  }
  const toRemove = await db
    .select()
    .from(ipBans)
    .where(and(isNotNull(ipBans.externalId), or(isNotNull(ipBans.liftedAt), lte(ipBans.expiresAt, new Date()))))
    .limit(50);
  for (const ban of toRemove) {
    await cloudflare(`/${ban.externalId}`, { method: "DELETE" }).catch((error) => {
      // Already removed on the Cloudflare side.
      if (!String(error).includes("not found")) throw error;
    });
    await db.update(ipBans).set({ externalId: null, syncedAt: new Date() }).where(eq(ipBans.id, ban.id));
    changes += 1;
  }
  return changes;
}

export async function syncBans(): Promise<number> {
  const mode = process.env.BAN_SYNC ?? "none";
  if (mode === "cloudflare") return syncCloudflare();
  if (mode === "htaccess") return syncHtaccess();
  return 0;
}
