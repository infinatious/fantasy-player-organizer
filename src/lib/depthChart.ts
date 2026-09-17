// Shared types/constants for the per-league depth chart tool. Kept free of
// server-only imports (better-sqlite3) so it can be used from client
// components as well as the API route — see depthChartDb.ts for persistence.

export const OFFENSE_POSITIONS = ["QB", "RB", "WR", "TE", "K", "P", "DEF"] as const;
export const IDP_POSITIONS = ["DL", "LB", "DB"] as const;
export const POSITIONS = [...OFFENSE_POSITIONS, ...IDP_POSITIONS];
export const STARTER_ORDER = ["QB", "RB", "WR", "TE", "FLEX", "K", "P", "DEF", "DL", "LB", "DB", "IDPFLEX"];
export const FLEX_TYPES = ["FLEX", "IDPFLEX"];
export const RESERVE_KINDS = ["backup", "stash"] as const;

// Offense FLEX has no zone of its own — a flex-eligible starter beyond
// their own position's direct cap just sits in their own starter-<pos>
// zone, and "is this the extra one" is a display-time question. This is
// the shared bookkeeping both the UI and the weekly starter-sync use to
// answer it consistently. IDP FLEX keeps its own dedicated zone and isn't
// part of this.
export const OFFENSE_FLEX_POSITIONS = ["RB", "WR", "TE"] as const;

export function offenseFlexUsed(players: DepthChartPlayer[], settings: DepthChartSettings): number {
  let used = 0;
  for (const pos of OFFENSE_FLEX_POSITIONS) {
    const count = players.filter((p) => p.zone === `starter-${pos}`).length;
    used += Math.max(0, count - settings[pos]);
  }
  return used;
}

export interface DepthChartPlayer {
  id: string;
  playerId: string | null;
  name: string;
  position: string;
  team: string | null;
  injuryStatus: string | null;
  zone: string;
  order: number;
}

export interface DepthChartSettings {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  K: number;
  P: number;
  DEF: number;
  DL: number;
  LB: number;
  DB: number;
  IDPFLEX: number;
  BENCH: number;
  IR: number;
  TAXI: number;
}

export interface DepthChartData {
  settings: DepthChartSettings;
  players: DepthChartPlayer[];
}

// IDP is a niche league type, so those default to off (0) rather than
// showing an empty defensive section most leagues will never use. Team
// defense is common enough to default on; the punter is rare enough to
// default off, same as IDP.
export const DEFAULT_DEPTH_CHART_SETTINGS: DepthChartSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  P: 0,
  DEF: 1,
  DL: 0,
  LB: 0,
  DB: 0,
  IDPFLEX: 0,
  BENCH: 6,
  IR: 2,
  TAXI: 3,
};

export function emptyDepthChartData(): DepthChartData {
  return { settings: { ...DEFAULT_DEPTH_CHART_SETTINGS }, players: [] };
}

// Fills in any settings keys missing from older saved data (e.g. if a new
// slot type is added later) rather than assuming the shape is always current.
// Also re-homes any player still sitting in the now-retired "starter-FLEX"
// zone into their own position's starter zone — offense FLEX no longer has
// a dedicated zone; who's "the extra" is a display-time computation based
// on order within that position's zone instead. IDP FLEX is unaffected.
export function normalizeDepthChartData(data: Partial<DepthChartData> | null | undefined): DepthChartData {
  const settings = { ...DEFAULT_DEPTH_CHART_SETTINGS, ...(data?.settings ?? {}) };
  const rawPlayers = Array.isArray(data?.players) ? data.players : [];
  const players = rawPlayers.map((p) =>
    p.zone === "starter-FLEX" ? { ...p, zone: `starter-${mapToDepthChartPosition(p.position) ?? p.position}` } : p
  );
  return { settings, players };
}

export function buildAcceptMap(): Record<string, string[]> {
  const accept: Record<string, string[]> = {};
  STARTER_ORDER.forEach((pos) => {
    if (pos === "FLEX") return; // no dedicated zone — flex-eligible players live in their own position's zone
    if (pos === "IDPFLEX") { accept["starter-IDPFLEX"] = ["DL", "LB", "DB"]; return; }
    accept["starter-" + pos] = [pos];
  });
  POSITIONS.forEach((pos) => {
    accept["backup-" + pos] = [pos];
    accept["stash-" + pos] = [pos];
  });
  accept.ir = POSITIONS.slice();
  accept.taxi = POSITIONS.slice();
  accept.cut = POSITIONS.slice();
  return accept;
}

// Maps a players-table position (including IDP sub-positions and FB, as
// fetched from Sleeper) onto the coarser buckets this tool understands.
const POSITION_ALIASES: Record<string, string> = {
  FB: "RB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  ILB: "LB",
  OLB: "LB",
  DE: "DL",
  DT: "DL",
  NT: "DL",
};

export function mapToDepthChartPosition(position: string | null | undefined): string | null {
  if (!position) return null;
  if ((POSITIONS as string[]).includes(position)) return position;
  return POSITION_ALIASES[position] ?? null;
}

export function posFullName(pos: string): string {
  return (
    {
      QB: "Quarterback",
      RB: "Running Back",
      WR: "Wide Receiver",
      TE: "Tight End",
      K: "Kicker",
      P: "Punter",
      DEF: "Team Defense",
      DL: "Defensive Line",
      LB: "Linebacker",
      DB: "Defensive Back",
    }[pos] || pos
  );
}

export function uid(): string {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
