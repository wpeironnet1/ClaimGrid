import type { NextConfig } from "next";
import { webSecurityHeaders } from "@claimgrid/core";

const nextConfig: NextConfig = {
  transpilePackages: ["@claimgrid/core"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: [...webSecurityHeaders] }];
  }
};
export default nextConfig;
