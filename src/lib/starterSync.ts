// Syncs a league's depth-chart starters from a weekly matchup/roster paste:
// a player in this week's lineup who isn't currently in a starter zone gets
// promoted into one; a player currently starting who's absent from the
// paste gets demoted to bench. Bench/order among non-starters is left
// untouched — this only ever moves players into or out of "starter-*".
import { normalizeName } from "./normalize";
import {
  type DepthChartData,
  type DepthChartPlayer,
  type DepthChartSettings,
  OFFENSE_FLEX_POSITIONS,
  offenseFlexUsed,
  uid,
} from "./depthChart";

export interface StartingPlayerInput {
  playerId: string | null;
  name: string;
  position: string; // already mapped to a depth-chart position (QB/RB/WR/.../DB)
  team: string | null;
}

export interface StarterSyncResult {
  data: DepthChartData;
  promoted: string[];
  demoted: string[];
  overflow: boolean;
}

// A platform's own roster-management page usually lists bench (and IR/taxi)
// below the starters under one of these section headers; a live matchup/box
// score view usually doesn't include them at all. When a header is found,
// only the text above it counts as "starting this week."
const BENCH_SECTION_HEADERS = new Set(["bench", "injured reserve", "ir", "taxi", "taxi squad"]);

export function stripBenchSection(text: string): string {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => BENCH_SECTION_HEADERS.has(l.replace(/\t+/g, " ").trim().toLowerCase()));
  return idx === -1 ? text : lines.slice(0, idx).join("\n");
}

// IDP flex keeps its own dedicated zone — only offense flex was folded into
// each position's own zone (see offenseFlexUsed in depthChart.ts).
const IDP_FLEX_POSITIONS = new Set(["DL", "LB", "DB"]);
const OFFENSE_FLEX_POSITION_SET = new Set<string>(OFFENSE_FLEX_POSITIONS);

function playerKey(playerId: string | null, name: string): string {
  return playerId ?? `name:${normalizeName(name)}`;
}

function nextOrder(players: DepthChartPlayer[], zone: string): number {
  const orders = players.filter((p) => p.zone === zone).map((p) => p.order);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

export function computeStarterSync(current: DepthChartData, starters: StartingPlayerInput[]): StarterSyncResult {
  const players = current.players.map((p) => ({ ...p }));
  const settings = current.settings;
  const startingKeys = new Set(starters.map((s) => playerKey(s.playerId, s.name)));

  const promoted: string[] = [];
  const demoted: string[] = [];
  let overflow = false;

  // Absent from this week's paste but currently starting -> bench.
  for (const p of players) {
    if (!p.zone.startsWith("starter-")) continue;
    if (startingKeys.has(playerKey(p.playerId, p.name))) continue;
    p.zone = `backup-${p.position}`;
    p.order = nextOrder(players, p.zone);
    demoted.push(p.name);
  }

  // In this week's paste but not currently starting -> promote.
  for (const s of starters) {
    const key = playerKey(s.playerId, s.name);
    const existingIdx = players.findIndex((p) => playerKey(p.playerId, p.name) === key);
    if (existingIdx !== -1 && players[existingIdx].zone.startsWith("starter-")) continue;

    const settingsKey = s.position as keyof DepthChartSettings;
    const directCap = (settings[settingsKey] as number | undefined) ?? 0;
    const directZone = `starter-${s.position}`;
    const directCount = players.filter((p) => p.zone === directZone).length;
    const isOffenseFlex = OFFENSE_FLEX_POSITION_SET.has(s.position);
    const isIdpFlex = IDP_FLEX_POSITIONS.has(s.position);

    let zone = directZone;
    if (isOffenseFlex) {
      if (directCap === 0 && settings.FLEX === 0) continue; // not used at all in this league
      // Always their own zone — offense flex has no zone of its own; flag
      // overflow only if even the shared flex pool has no room left.
      if (directCount >= directCap && offenseFlexUsed(players, settings) >= settings.FLEX) overflow = true;
    } else if (isIdpFlex) {
      if (directCap === 0 && settings.IDPFLEX === 0) continue; // e.g. IDP off entirely
      if (directCount >= directCap) {
        const idpFlexCount = players.filter((p) => p.zone === "starter-IDPFLEX").length;
        if (idpFlexCount < settings.IDPFLEX) {
          zone = "starter-IDPFLEX";
        } else {
          overflow = true;
        }
      }
    } else {
      if (directCap === 0) continue; // position not used at all (e.g. K/DEF off)
      if (directCount >= directCap) overflow = true;
    }

    const order = nextOrder(players, zone);
    if (existingIdx !== -1) {
      players[existingIdx] = { ...players[existingIdx], zone, order };
    } else {
      players.push({
        id: uid(),
        playerId: s.playerId,
        name: s.name,
        position: s.position,
        team: s.team,
        injuryStatus: null,
        zone,
        order,
      });
    }
    promoted.push(s.name);
  }

  return { data: { settings, players }, promoted, demoted, overflow };
}
