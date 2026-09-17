export type Platform = "sleeper" | "espn" | "yahoo";

export const PLATFORM_LABEL: Record<Platform, string> = {
  sleeper: "Sleeper",
  espn: "ESPN",
  yahoo: "Yahoo!",
};

export const PLATFORM_LOGO: Record<Platform, string> = {
  sleeper: "/platform-logos/sleeper.png",
  espn: "/platform-logos/espn.svg",
  yahoo: "/platform-logos/yahoo.svg",
};

// Each mark is a white glyph on transparent — this is its badge backdrop.
export const PLATFORM_COLOR: Record<Platform, string> = {
  sleeper: "#213252",
  espn: "#990000",
  yahoo: "#6001D2",
};
