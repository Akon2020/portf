import { execSync } from "node:child_process";

/** Resets and seeds the test database before the suite. */
export default function globalSetup() {
  execSync("pnpm exec tsx tests/e2e/seed.ts", { stdio: "inherit", env: process.env });
}
