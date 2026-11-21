/**
 * Seeds the end to end test database: run by the Playwright global setup.
 * Refuses to run on a database whose name does not contain "test".
 * The credentials below are test values, valid only in this database.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { encryptSecret } from "../../src/server/auth/crypto";
import { hashPassword } from "../../src/server/auth/password";
import { closeDb, getDb } from "../../src/server/db";
import { clientProjects, clients, projects, users } from "../../src/server/db/schema";

export const E2E = {
  admin: { email: "e2e-admin@example.test", password: "Bukavu-Lac-Kivu-2026" },
  totpAdmin: { email: "e2e-totp@example.test", password: "Bukavu-Lac-Kivu-2026", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" },
  lockAdmin: { email: "e2e-lock@example.test", password: "Bukavu-Lac-Kivu-2026" },
  portalClient: { email: "e2e-client@example.test" },
};

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.includes("test")) throw new Error("La base des tests e2e doit contenir 'test' dans son nom.");
  const db = getDb();
  await migrate(db, { migrationsFolder: "drizzle" });
  const tables = await db.execute<{ tablename: string }>(sql`select tablename from pg_tables where schemaname = 'public'`);
  await db.execute(sql.raw(`truncate table ${tables.map((row) => `"${row.tablename}"`).join(", ")} restart identity cascade`));

  const passwordHash = await hashPassword(E2E.admin.password);
  const key = Buffer.from(process.env.AUTH_ENCRYPTION_KEY ?? "", "base64");
  await db.insert(users).values([
    { email: E2E.admin.email, name: "Admin E2E", role: "super_admin", passwordHash },
    { email: E2E.lockAdmin.email, name: "Lock E2E", role: "super_admin", passwordHash },
    { email: E2E.totpAdmin.email, name: "TOTP E2E", role: "super_admin", passwordHash, totpSecretEnc: encryptSecret(E2E.totpAdmin.secret, key), totpEnabledAt: new Date() },
  ]);

  await db.insert(projects).values({
    slug: "projet-e2e",
    title: { fr: "Projet de démonstration E2E", en: "E2E demo project" },
    summary: { fr: "Résumé du projet de démonstration.", en: "Demo project summary." },
    categories: ["web"],
    status: "published",
    publishedAt: new Date(),
  });

  const [alpha] = await db.insert(clients).values({ name: "Client Alpha", email: E2E.portalClient.email, portalEnabled: true }).returning();
  const [beta] = await db.insert(clients).values({ name: "Client Beta", email: "e2e-beta@example.test" }).returning();
  const [user] = await db.insert(users).values({ email: E2E.portalClient.email, name: "Client Alpha", role: "client", clientId: alpha.id }).returning();
  await db.update(clients).set({ userId: user.id }).where(sql`${clients.id} = ${alpha.id}`);
  const [alphaProject] = await db.insert(clientProjects).values({ clientId: alpha.id, name: "Projet Alpha", status: "in_progress", visibleToClient: true }).returning();
  const [betaProject] = await db.insert(clientProjects).values({ clientId: beta.id, name: "Projet Beta", status: "in_progress", visibleToClient: true }).returning();

  mkdirSync(".tmp-e2e", { recursive: true });
  rmSync(process.env.MAIL_OUTBOX_DIR ?? ".tmp-e2e/outbox", { recursive: true, force: true });
  writeFileSync(".tmp-e2e/seed.json", JSON.stringify({ alphaProject: alphaProject.id, betaProject: betaProject.id }));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
