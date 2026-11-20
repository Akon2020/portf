import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { baseSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Self-contained server bundle deployed to cPanel (Phusion Passenger).
  output: "standalone",
  poweredByHeader: false,
  // Native modules loaded at runtime instead of being bundled.
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  // The storage driver builds file paths at runtime, which makes file tracing
  // include the whole project: only runtime files may reach the server.
  outputFileTracingExcludes: {
    "*": [
      "./release/**",
      "./portfolio_data/**",
      "./src/**",
      "./tests/**",
      "./docs/**",
      "./scripts/**",
      "./cron/**",
      "./dist/**",
      "./drizzle/**",
      "./.claude/**",
      "./*.md",
      "./*.log",
      "./*.config.*",
      "./tsconfig*.json",
      "./components.json",
      "./pnpm-*.yaml",
    ],
  },
  images: {
    // Kept until sharp is confirmed to load on the shared hosting.
    unoptimized: true,
  },
  async rewrites() {
    // Browsers request /favicon.ico on their own: serve the generated icon.
    return [{ source: "/favicon.ico", destination: "/icon" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: baseSecurityHeaders(process.env.NODE_ENV !== "production"),
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
