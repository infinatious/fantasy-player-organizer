import { PLATFORM_LABEL, PLATFORM_LOGO, PLATFORM_COLOR, type Platform } from "@/lib/platforms";
import { withBasePath } from "@/lib/basePath";

// Each platform's own brand color as a fixed backdrop (regardless of theme)
// behind its white glyph — consistent and legible in both light and dark mode.
export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      title={PLATFORM_LABEL[platform]}
      style={{ backgroundColor: PLATFORM_COLOR[platform] }}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={withBasePath(PLATFORM_LOGO[platform])} alt={PLATFORM_LABEL[platform]} className="h-3.5 w-3.5 object-contain" />
    </span>
  );
}
