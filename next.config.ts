import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // photo uploads (up to 4 images) go through server actions
      bodySizeLimit: "20mb",
    },
  },
  // Render free tier: filesystem is ephemeral → serve /uploads/* from DB via route handler.
  // Rewrites are not needed because src/app/uploads/[...path] already handles /uploads/*,
  // but keep headers for caching.
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
