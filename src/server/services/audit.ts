import { getDb } from "../db";
import { auditLogs } from "../db/schema";

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  diff?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/** Writes an audit trail entry. Never throws: auditing must not break the action. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await getDb()
      .insert(auditLogs)
      .values({
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        diff: entry.diff ?? null,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      });
  } catch (error) {
    console.error("[audit] write failed", error);
  }
}
