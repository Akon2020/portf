import { date, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, id, timestamptz } from "./columns";

export const securityCategory = pgEnum("security_category", [
  "path_scan",
  "sqli",
  "xss",
  "path_traversal",
  "cmd_injection",
  "brute_force",
  "rate_abuse",
  "bad_bot",
  "honeypot",
  "forbidden_method",
  "invalid_token",
  "other",
]);
export const securitySeverity = pgEnum("security_severity", ["low", "medium", "high", "critical"]);
export const securityAction = pgEnum("security_action", ["logged", "challenged", "blocked", "banned"]);
export const banSource = pgEnum("ban_source", ["auto", "manual"]);

/** Page views, without raw IP: visitors are a daily salted hash. */
export const pageViews = pgTable(
  "page_views",
  {
    id: id(),
    path: text("path").notNull(),
    locale: text("locale"),
    referrer: text("referrer"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    country: text("country"),
    device: text("device"),
    browser: text("browser"),
    os: text("os"),
    visitorHash: text("visitor_hash").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("page_views_created_idx").on(table.createdAt), index("page_views_path_idx").on(table.path, table.createdAt)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, string | number | boolean>>().notNull().default({}),
    visitorHash: text("visitor_hash").notNull(),
    path: text("path"),
    createdAt: createdAt(),
  },
  (table) => [index("analytics_events_name_idx").on(table.name, table.createdAt)],
);

/** Daily aggregates kept after the raw rows are purged (13 months). */
export const dailyStats = pgTable(
  "daily_stats",
  {
    day: date("day", { mode: "string" }).notNull(),
    metric: text("metric").notNull(),
    dimension: text("dimension").notNull().default(""),
    value: integer("value").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.metric, table.dimension] })],
);

export const securityEvents = pgTable(
  "security_events",
  {
    id: id(),
    ip: text("ip").notNull(),
    method: text("method").notNull(),
    path: text("path").notNull(),
    query: text("query"),
    userAgent: text("user_agent"),
    category: securityCategory("category").notNull(),
    ruleId: text("rule_id").notNull(),
    severity: securitySeverity("severity").notNull(),
    score: integer("score").notNull().default(0),
    payloadExcerpt: text("payload_excerpt"),
    country: text("country"),
    actionTaken: securityAction("action_taken").notNull().default("logged"),
    createdAt: createdAt(),
  },
  (table) => [
    index("security_events_created_idx").on(table.createdAt),
    index("security_events_ip_idx").on(table.ip, table.createdAt),
    index("security_events_category_idx").on(table.category, table.createdAt),
  ],
);

export const ipReputation = pgTable("ip_reputation", {
  ip: text("ip").primaryKey(),
  score: integer("score").notNull().default(0),
  firstSeenAt: timestamptz("first_seen_at").notNull().defaultNow(),
  lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
  eventsCount: integer("events_count").notNull().default(0),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  bansCount: integer("bans_count").notNull().default(0),
});

export const ipBans = pgTable(
  "ip_bans",
  {
    id: id(),
    ipOrCidr: text("ip_or_cidr").notNull(),
    reason: text("reason").notNull(),
    source: banSource("source").notNull(),
    ruleId: text("rule_id"),
    bannedAt: timestamptz("banned_at").notNull().defaultNow(),
    /** Null means permanent. */
    expiresAt: timestamptz("expires_at"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    hitCount: integer("hit_count").notNull().default(0),
    liftedAt: timestamptz("lifted_at"),
    syncedAt: timestamptz("synced_at"),
    externalId: text("external_id"),
  },
  (table) => [index("ip_bans_active_idx").on(table.liftedAt, table.expiresAt), index("ip_bans_ip_idx").on(table.ipOrCidr)],
);

export const ipAllowlist = pgTable(
  "ip_allowlist",
  {
    id: id(),
    ipOrCidr: text("ip_or_cidr").notNull(),
    label: text("label").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("ip_allowlist_ip_idx").on(table.ipOrCidr)],
);

/** Server errors captured by the instrumentation hook. */
export const errorLogs = pgTable(
  "error_logs",
  {
    id: id(),
    message: text("message").notNull(),
    stack: text("stack"),
    digest: text("digest"),
    method: text("method"),
    path: text("path"),
    routeType: text("route_type"),
    createdAt: createdAt(),
  },
  (table) => [index("error_logs_created_idx").on(table.createdAt)],
);

export type SecurityEvent = typeof securityEvents.$inferSelect;
export type IpBan = typeof ipBans.$inferSelect;
export type SecurityCategory = (typeof securityCategory.enumValues)[number];
export type SecuritySeverity = (typeof securitySeverity.enumValues)[number];
