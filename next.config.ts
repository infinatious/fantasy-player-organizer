import type { NextConfig } from "next";

// See src/lib/basePath.ts — set per-deployment by install_vps.sh/update_app.sh
// so this instance can be reached at a random per-tenant path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  basePath,
};

export default nextConfig;
