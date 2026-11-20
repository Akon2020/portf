/**
 * Scans project files for characters that must never be shipped:
 * em dash, en dash, section sign and emoji.
 *
 * Usage:
 *   pnpm check:chars              scans the whole project
 *   pnpm check:chars file1 file2  scans only the given files (pre-commit hook)
 *   pnpm check:chars --any file    scans a file whatever its extension (commit message)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ForbiddenRule {
  id: string;
  label: string;
  pattern: RegExp;
}

export const FORBIDDEN_RULES: ForbiddenRule[] = [
  { id: "em-dash", label: "tiret cadratin (U+2014)", pattern: /\u{2014}/gu },
  { id: "en-dash", label: "tiret demi-cadratin (U+2013)", pattern: /\u{2013}/gu },
  { id: "section-sign", label: "signe paragraphe (U+00A7)", pattern: /\u{A7}/gu },
  { id: "emoji", label: "emoji", pattern: /[\p{Emoji_Presentation}\u{FE0F}]/gu },
];

export interface Violation {
  file: string;
  line: number;
  column: number;
  rule: string;
  excerpt: string;
}

const SCANNED_DIRS = ["src", "tests", "scripts", "cron", "docs", "drizzle", "public", ".github"];
const SCANNED_ROOT_FILES = [
  "README.md",
  ".env.example",
  "package.json",
  "next.config.ts",
  "next.config.mjs",
  "proxy.ts",
  "server.js",
  "drizzle.config.ts",
  "eslint.config.mjs",
  "vitest.config.mts",
  ".cpanel.yml",
];
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".css",
  ".yml",
  ".yaml",
  ".html",
  ".txt",
  ".sql",
  ".svg",
  ".example",
]);
const IGNORED_DIRS = new Set(["node_modules", ".next", ".git", "dist", "coverage", "test-results"]);

export const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function walk(dir: string, files: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) walk(full, files);
    else if (isTextFile(full)) files.push(full);
  }
}

function isTextFile(file: string): boolean {
  return TEXT_EXTENSIONS.has(extname(file).toLowerCase()) || file.endsWith(".env.example");
}

export function listProjectFiles(root = projectRoot): string[] {
  const files: string[] = [];
  for (const dir of SCANNED_DIRS) walk(join(root, dir), files);
  for (const file of SCANNED_ROOT_FILES) {
    const full = join(root, file);
    try {
      if (statSync(full).isFile()) files.push(full);
    } catch {
      // File does not exist yet.
    }
  }
  return files;
}

export function scanText(text: string, file: string): Violation[] {
  const violations: Violation[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((content, index) => {
    for (const rule of FORBIDDEN_RULES) {
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(content)) !== null) {
        violations.push({
          file,
          line: index + 1,
          column: match.index + 1,
          rule: rule.label,
          excerpt: content.trim().slice(0, 120),
        });
      }
    }
  });
  return violations;
}

export function scanFiles(
  files: string[],
  root = projectRoot,
  options: { anyExtension?: boolean } = {},
): Violation[] {
  return files.flatMap((file) => {
    if (!options.anyExtension && !isTextFile(file)) return [];
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      return [];
    }
    return scanText(text, relative(root, file).replaceAll("\\", "/"));
  });
}

function main(): void {
  const rawArgs = process.argv.slice(2);
  const anyExtension = rawArgs.includes("--any");
  const args = rawArgs.filter((arg) => arg !== "--any").map((file) => resolve(file));
  const files = args.length > 0 ? args : listProjectFiles();
  const violations = scanFiles(files, projectRoot, { anyExtension });
  if (violations.length === 0) {
    console.log(`Typographie OK (${files.length} fichiers analysés).`);
    return;
  }
  for (const v of violations) {
    console.error(`${v.file}:${v.line}:${v.column}  ${v.rule}  ${v.excerpt}`);
  }
  console.error(`\n${violations.length} caractère(s) interdit(s) trouvé(s).`);
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
