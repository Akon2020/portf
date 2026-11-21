import { readFileSync, existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * End to end tests against the production build (pnpm build first), on the
 * test database. Locally, TEST_DATABASE_URL and AUTH_ENCRYPTION_KEY come
 * from .env.test.local and .env.local.
 */
function readEnvFile(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z0-9_]+=/.test(line))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, "")];
      }),
  );
}

const local = { ...readEnvFile(".env.local"), ...readEnvFile(".env.test.local") };
const port = 3200;
const env: Record<string, string> = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL ?? "",
  AUTH_ENCRYPTION_KEY: process.env.AUTH_ENCRYPTION_KEY ?? local.AUTH_ENCRYPTION_KEY ?? "",
  SITE_URL: `http://localhost:${port}`,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  TRUST_PROXY: "true",
  TZ: "Africa/Lubumbashi",
  DATA_DIR: ".tmp-e2e/data",
  PRIVATE_DIR: ".tmp-e2e/data/private",
  UPLOADS_DIR: ".tmp-e2e/data/uploads",
  MAIL_OUTBOX_DIR: ".tmp-e2e/outbox",
  ADMIN_EMAIL: "e2e-admin@example.test",
};
Object.assign(process.env, env);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    locale: "fr-FR",
    timezoneId: "Africa/Lubumbashi",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /responsive\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm exec next start --port ${port}`,
    url: `http://localhost:${port}/robots.txt`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env,
  },
});
