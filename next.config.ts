import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Receipt scans send a downsized photo (or a small PDF) to a server
      // action; the default 1 MB is too tight. Vercel's own cap is 4.5 MB.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
