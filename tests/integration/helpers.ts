import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "@/server/db";

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

let migrated = false;

export async function prepareTestDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error("Les tests d'intégration exigent une base dont le nom contient 'test'");
  }
  if (!migrated) {
    await migrate(getDb(), { migrationsFolder: "drizzle" });
    migrated = true;
  }
  await getDb().execute(sql`
    truncate table page_views, analytics_events, daily_stats, security_events, ip_reputation, ip_bans, ip_allowlist, error_logs, push_subscriptions, reminders, tasks, receipts, payments, invoice_items, invoices, project_files, project_updates, milestones, client_projects, gallery_items, gallery_albums, posts, document_sends, quote_items, quotes, sequences, quote_requests, messages, conversations, contacts, clients, project_images, projects, journey_items, skills, services, testimonials, social_links, stats, media, users, sessions, auth_tokens, backup_codes, trusted_ips, login_attempts,
      audit_logs, settings, rate_limits, jobs, cron_runs restart identity cascade
  `);
}
