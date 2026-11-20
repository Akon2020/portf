import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { hashPassword, verifyPassword } from "../auth/password";

interface Check {
  name: string;
  critical: boolean;
  run: () => Promise<string>;
}

const checks: Check[] = [
  {
    name: "Base de données",
    critical: true,
    run: async () => {
      const rows = await getDb().execute<{ version: string }>(sql`select version() as version`);
      return String(rows[0]?.version ?? "").split(",")[0];
    },
  },
  {
    name: "Argon2id",
    critical: true,
    run: async () => {
      const hash = await hashPassword("healthcheck password value");
      if (!(await verifyPassword(hash, "healthcheck password value"))) throw new Error("vérification échouée");
      return "hachage et vérification OK";
    },
  },
  {
    name: "Dossier de données",
    critical: true,
    run: async () => {
      const dir = resolve(process.env.DATA_DIR ?? "./portfolio_data");
      await mkdir(dir, { recursive: true });
      const file = join(dir, `.healthcheck-${process.pid}`);
      await writeFile(file, "ok");
      await rm(file);
      return `écriture OK dans ${dir}`;
    },
  },
  {
    name: "sharp",
    critical: false,
    run: async () => {
      const moduleName = "sharp";
      const sharp = (await import(/* webpackIgnore: true */ moduleName)).default;
      const buffer = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#000" } }).png().toBuffer();
      return `chargé, ${buffer.length} octets générés`;
    },
  },
  {
    name: "SMTP",
    critical: false,
    run: async () => {
      if (!process.env.SMTP_HOST) throw new Error("non configuré (SMTP_HOST vide)");
      return `${process.env.SMTP_HOST}:${process.env.SMTP_PORT ?? 465} (test d'envoi disponible avec le module e-mail)`;
    },
  },
];

/** Smoke test run after each deployment: database, Argon2, disk, sharp, SMTP. */
export async function healthcheck(): Promise<number> {
  let failedCritical = false;
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`[OK]      ${check.name} : ${detail}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[${check.critical ? "ERREUR" : "ATTENTION"}] ${check.name} : ${message}`);
      if (check.critical) failedCritical = true;
    }
  }
  return failedCritical ? 1 : 0;
}
