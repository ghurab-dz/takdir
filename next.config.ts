import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // photo uploads (up to 4 images) go through server actions
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
