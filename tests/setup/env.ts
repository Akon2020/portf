import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";

loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

// Tests only ever touch the dedicated test database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

process.env.AUTH_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
process.env.TRUST_PROXY = "false";
