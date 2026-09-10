import type { CSSProperties } from "react";

// Primary brand color per NFL team, used for the dashboard's per-card glow.
// Teams whose primary color is near-black/white (e.g. Raiders, Saints) use
// their brighter secondary color instead so the glow is actually visible.
export const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#C83803",
  CIN: "#FB4F14",
  CLE: "#FF3C00",
  DAL: "#003594",
  DEN: "#FB4F14",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#A71930",
  IND: "#002C5F",
  JAX: "#006778",
  KC: "#E31837",
  LAC: "#0080C6",
  LAR: "#003594",
  LV: "#A5ACAF",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SF: "#AA0000",
  SEA: "#69BE28",
  TB: "#D50A0A",
  TEN: "#4B92DB",
  WAS: "#5A1414",
};

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function teamGlowStyle(team: string | null): CSSProperties {
  const color = team ? TEAM_COLORS[team] : undefined;
  if (!color) return {};
  return {
    boxShadow: `inset 0 0 28px 0 ${hexToRgba(color, 0.35)}`,
  };
}

export function playerImageUrl(playerId: string, position: string | null): string {
  if (position === "DEF") {
    return `https://sleepercdn.com/images/team_logos/nfl/${playerId.toLowerCase()}.png`;
  }
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}
