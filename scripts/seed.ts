/**
 * pnpm seed             base data (settings, social links, services, skills)
 * pnpm seed:content     content of both sites, drafts flagged for review
 *   --no-images         skips downloading images
 */
import { loadEnvConfig } from "@next/env";
import { closeDb } from "../src/server/db";
import { seedBase } from "../src/server/seed/base";
import { seedContent } from "../src/server/seed/content";

loadEnvConfig(process.cwd());

async function main() {
  const [target, ...flags] = process.argv.slice(2);
  const log = (message: string) => console.log(message);
  if (target === "base" || target === "all") await seedBase(log);
  if (target === "content" || target === "all") {
    await seedBase(log);
    await seedContent(log, { images: !flags.includes("--no-images") });
  }
  if (!["base", "content", "all"].includes(target ?? "")) {
    console.error("Usage : tsx scripts/seed.ts base|content|all [--no-images]");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
