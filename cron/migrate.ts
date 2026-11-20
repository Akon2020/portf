/** Applies pending migrations in production: node dist/migrate.js */
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../src/server/db";

loadEnvConfig(process.cwd());

const migrationsFolder = resolve(process.env.MIGRATIONS_DIR ?? "drizzle");

migrate(getDb(), { migrationsFolder })
  .then(async () => {
    console.log(`Migrations appliquées depuis ${migrationsFolder}`);
    await closeDb();
  })
  .catch(async (error) => {
    console.error(error);
    await closeDb();
    process.exit(1);
  });
