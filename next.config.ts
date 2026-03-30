import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "192.168.3.37",
    "cadiboklkpojfamcoggejbbdjcoiljjk",
  ],
  devIndicators: false,
};

export default nextConfig;
