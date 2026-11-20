import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle deployed to cPanel (Phusion Passenger).
  output: "standalone",
  poweredByHeader: false,
  images: {
    // Kept until sharp is confirmed to load on the shared hosting.
    unoptimized: true,
  },
};

export default nextConfig;
