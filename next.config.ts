import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // The dev overlay badge sits on top of the board during a demo.
  devIndicators: false,
};

export default nextConfig;
