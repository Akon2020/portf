import { createElement } from "react";
import { and, desc, gte, inArray, sql } from "drizzle-orm";
import { SecurityEmail } from "@/emails/templates";
import { getSiteUrl } from "@/lib/site";
import { readSettingUncached } from "@/server/content/settings-store";
import { getDb } from "@/server/db";
import { ipBans, securityEvents } from "@/server/db/schema";
import { renderMail, sendMailOrQueue } from "@/server/mail/send";
import { pushToAdmins } from "@/server/services/push";
import { notifyAdmins } from "@/server/services/notifications";

/** Grouped alert: critical events and automatic bans since the previous alert. */
export async function sendSecurityDigest(since: Date): Promise<number> {
  const db = getDb();
  const [critical, bans, totals] = await Promise.all([
    db
      .select()
      .from(securityEvents)
      .where(and(gte(securityEvents.createdAt, since), inArray(securityEvents.severity, ["critical"])))
      .orderBy(desc(securityEvents.createdAt))
      .limit(20),
    db.select().from(ipBans).where(and(gte(ipBans.bannedAt, since), inArray(ipBans.source, ["auto"]))).orderBy(desc(ipBans.bannedAt)).limit(20),
    db
      .select({ category: securityEvents.category, count: sql<number>`count(*)::int` })
      .from(securityEvents)
      .where(gte(securityEvents.createdAt, since))
      .groupBy(securityEvents.category),
  ]);
  if (critical.length === 0 && bans.length === 0) return 0;
  const lines = [
    ...bans.map((ban) => `IP bannie automatiquement : ${ban.ipOrCidr} (${ban.reason})${ban.expiresAt ? "" : ", bannissement permanent"}.`),
    ...critical.map((event) => `Événement critique ${event.ruleId} depuis ${event.ip} sur ${event.path}.`),
    `Depuis ${since.toISOString().slice(11, 16)} UTC : ${totals.map((row) => `${row.category} ${row.count}`).join(", ")}.`,
  ];
  const url = new URL("/admin/monitoring/securite", getSiteUrl()).toString();
  const to = process.env.ADMIN_EMAIL || (await readSettingUncached("issuer")).email;
  const title = bans.length ? `${bans.length} IP bannie(s) automatiquement` : `${critical.length} événement(s) critique(s)`;
  if (to) {
    const mail = await renderMail(createElement(SecurityEmail, { title, lines, url, cta: "Voir le journal de sécurité" }));
    await sendMailOrQueue({ to, subject: `[Sécurité] ${title}`, ...mail });
  }
  await pushToAdmins({ title: "Alerte de sécurité", body: title, url, tag: "security" });
  await notifyAdmins({ type: "security", title: `Sécurité : ${title}`, body: lines[0] ?? null, url: "/admin/monitoring/securite" });
  return lines.length;
}
