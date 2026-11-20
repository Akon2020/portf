// Bundles the cron entry point and the migration runner into dist/.
import { build } from "esbuild";

await build({
  entryPoints: { cron: "cron/index.ts", migrate: "cron/migrate.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: true,
  // Native or optional modules resolved at runtime from node_modules.
  external: ["@node-rs/argon2", "sharp", "@react-pdf/renderer"],
  tsconfig: "tsconfig.json",
  logLevel: "info",
});
