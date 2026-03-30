import type { NextConfig } from "next";

const defaultAllowedDevOrigins = [
  "localhost",
  "127.0.0.1",
];

const extraAllowedDevOrigins = (process.env.OPENCRAB_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    ...new Set([...defaultAllowedDevOrigins, ...extraAllowedDevOrigins]),
  ],
  devIndicators: false,
};

export default nextConfig;
