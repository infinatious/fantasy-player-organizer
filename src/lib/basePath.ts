// Set at build time (see install_vps.sh / update_app.sh) so a per-tenant
// deployment can live under its own random path, e.g. /8f14e45f-...-0e6f,
// behind a single shared domain. next.config.ts reads the same env var for
// page routing and next/link/next/image rewriting; this helper covers the
// spots Next doesn't rewrite automatically — hardcoded absolute paths passed
// to fetch() and plain <img src="/..."> tags for local /public assets.
// Never wrap external URLs (e.g. the Sleeper CDN) with this.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${BASE_PATH}${path}`;
}
