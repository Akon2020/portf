import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";

export const userRole = pgEnum("user_role", ["super_admin", "editor", "viewer", "client"]);
export const sessionKind = pgEnum("session_kind", ["admin", "client"]);
export const authTokenType = pgEnum("auth_token_type", [
  "magic_link",
  "password_reset",
  "email_change",
  "invite",
]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: userRole("role").notNull(),
  // Linked client record, foreign key added with the CRM module.
  clientId: uuid("client_id"),
  emailVerifiedAt: timestamptz("email_verified_at"),
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: timestamptz("totp_enabled_at"),
  totpLastUsedStep: bigint("totp_last_used_step", { mode: "number" }),
  failedLoginCount: integer("failed_login_count").notNull().default(0),
  lockoutLevel: integer("lockout_level").notNull().default(0),
  lockedUntil: timestamptz("locked_until"),
  passwordChangedAt: timestamptz("password_changed_at"),
  lastLoginAt: timestamptz("last_login_at"),
  lastLoginIp: text("last_login_ip"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the session token, the raw token is never stored.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: sessionKind("kind").notNull(),
    twoFactorVerified: boolean("two_factor_verified").notNull().default(false),
    createdAt: createdAt(),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
    expiresAt: timestamptz("expires_at").notNull(),
    absoluteExpiresAt: timestamptz("absolute_expires_at").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    revokedAt: timestamptz("revoked_at"),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const authTokens = pgTable(
  "auth_tokens",
  {
    id: id(),
    type: authTokenType("type").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    requestIp: text("request_ip"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (table) => [index("auth_tokens_email_type_idx").on(table.email, table.type)],
);

export const backupCodes = pgTable(
  "backup_codes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
  },
  (table) => [index("backup_codes_user_id_idx").on(table.userId)],
);

export const trustedIps = pgTable(
  "trusted_ips",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ip: text("ip").notNull(),
    userAgent: text("user_agent"),
    label: text("label"),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("trusted_ips_user_ip_idx").on(table.userId, table.ip)],
);

export const loginAttempts = pgTable(
  "login_attempts",
  {
    id: id(),
    email: text("email").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    success: boolean("success").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (table) => [
    index("login_attempts_ip_idx").on(table.ip, table.createdAt),
    index("login_attempts_email_idx").on(table.email, table.createdAt),
  ],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: updatedAt(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type SessionKind = (typeof sessionKind.enumValues)[number];
