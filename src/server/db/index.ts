import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  portfolioSql?: postgres.Sql;
  portfolioDb?: Database;
};

function createClient(): postgres.Sql {
  return postgres(getEnv().DATABASE_URL, {
    // Shared hosting limits processes and connections: keep the pool small.
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: true,
  });
}

/** Lazily created so that importing this module never requires a database. */
export function getDb(): Database {
  if (!globalForDb.portfolioDb) {
    globalForDb.portfolioSql ??= createClient();
    globalForDb.portfolioDb = drizzle(globalForDb.portfolioSql, { schema });
  }
  return globalForDb.portfolioDb;
}

export async function closeDb(): Promise<void> {
  await globalForDb.portfolioSql?.end({ timeout: 5 });
  globalForDb.portfolioSql = undefined;
  globalForDb.portfolioDb = undefined;
}

export { schema };
