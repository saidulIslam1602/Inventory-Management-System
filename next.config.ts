import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment — creates a minimal self-contained build
  output: "standalone",

  // Disable Next.js telemetry in CI/prod
  experimental: {
    // Server Actions are stable in Next.js 15
  },

  images: {
    remotePatterns: [
      // Allow Aqila logo and product images from common CDNs
      { protocol: "https", hostname: "elproffen-cdn.imgix.net" },
      { protocol: "https", hostname: "www.aqila.no" },
    ],
  },

  // Strict mode catches potential React issues early
  reactStrictMode: true,
};

export default nextConfig;
