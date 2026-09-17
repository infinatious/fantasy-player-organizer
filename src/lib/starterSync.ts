// Syncs a league's depth-chart starters from a weekly matchup/roster paste:
// a player in this week's lineup who isn't currently in a starter zone gets
// promoted into one; a player currently starting who's absent from the
// paste gets demoted to bench. Bench/order among non-starters is left
// untouched — this only ever moves players into or out of "starter-*".
import { normalizeName } from "./normalize";
import { type DepthChartData, type DepthChartPlayer, type DepthChartSettings, uid } from "./depthChart";

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

const FLEX_ELIGIBLE: Record<string, keyof DepthChartSettings> = {
  RB: "FLEX",
  WR: "FLEX",
  TE: "FLEX",
  DL: "IDPFLEX",
  LB: "IDPFLEX",
  DB: "IDPFLEX",
};

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
    const directCap = settings[settingsKey] ?? 0;
    const flexKey = FLEX_ELIGIBLE[s.position];
    const flexCap = flexKey ? settings[flexKey] : 0;
    if (directCap === 0 && flexCap === 0) {
      // League doesn't use this position in starters at all (e.g. IDP off)
      // — nothing sensible to promote into, leave the player where they are.
      continue;
    }

    const directZone = `starter-${s.position}`;
    const directCount = players.filter((p) => p.zone === directZone).length;

    let zone: string;
    if (directCount < directCap) {
      zone = directZone;
    } else if (flexKey && players.filter((p) => p.zone === `starter-${flexKey}`).length < flexCap) {
      zone = `starter-${flexKey}`;
    } else {
      // No configured room left anywhere for this position — still honor
      // "add them to starting" rather than silently dropping the player,
      // but flag it so the UI can tell the user their slot counts look
      // stale (e.g. paste always shows 3 starting RBs but settings say 2).
      zone = directZone;
      overflow = true;
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
