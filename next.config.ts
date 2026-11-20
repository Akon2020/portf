import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { baseSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Self-contained server bundle deployed to cPanel (Phusion Passenger).
  output: "standalone",
  poweredByHeader: false,
  // Native modules loaded at runtime instead of being bundled.
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  images: {
    // Kept until sharp is confirmed to load on the shared hosting.
    unoptimized: true,
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
