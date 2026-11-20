import type { NextConfig } from "next";
import { baseSecurityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // Self-contained server bundle deployed to cPanel (Phusion Passenger).
  output: "standalone",
  poweredByHeader: false,
  // Native modules loaded at runtime instead of being bundled.
  serverExternalPackages: ["@node-rs/argon2"],
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

export default nextConfig;
