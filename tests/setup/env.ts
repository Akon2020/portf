import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

loadEnvConfig(process.cwd(), false, { info: () => {}, error: console.error });

// Tests only ever touch the dedicated test database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else {
  delete process.env.DATABASE_URL;
}

process.env.AUTH_ENCRYPTION_KEY ||= randomBytes(32).toString("base64");
process.env.TRUST_PROXY = "false";
// E-mails are written to a temporary outbox, never sent.
delete process.env.SMTP_HOST;
process.env.MAIL_OUTBOX_DIR = join(tmpdir(), "portfolio-test-outbox");
process.env.SITE_URL = "https://portfolio.test";
