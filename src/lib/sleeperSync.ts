// Prototype: pull a league's real roster straight from Sleeper's public API
// instead of pasting text. Sleeper needs no auth at all for this — just a
// league ID, which is genuinely the easy case among the three platforms
// (see the ESPN/Yahoo write-up: no official API / full OAuth2 respectively).
import { getPlayerById, type PlayerRow } from "./players";
import { mapToDepthChartPosition, uid, type DepthChartData, type DepthChartPlayer, type DepthChartSettings } from "./depthChart";

const SLEEPER_BASE = "https://api.sleeper.app/v1";

interface SleeperLeague {
  name: string;
  roster_positions: string[];
  settings?: { reserve_slots?: number; taxi_slots?: number };
}

interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
}

interface SleeperUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}

export interface SleeperTeamOption {
  rosterId: number;
  ownerName: string;
  teamName: string | null;
  playerCount: number;
}

interface SleeperMatchupEntry {
  roster_id: number;
  matchup_id: number | null;
  starters: string[] | null;
}

export interface SleeperMatchupPlayer {
  playerId: string;
  displayName: string;
  team: string | null;
  position: string | null;
}

export interface SleeperMatchupResult {
  myLabel: string;
  opponentLabel: string | null;
  minePlayers: SleeperMatchupPlayer[];
  opponentPlayers: SleeperMatchupPlayer[];
}

function teamLabel(t: SleeperTeamOption): string {
  return t.teamName ? `${t.teamName} (${t.ownerName})` : t.ownerName;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sleeper API ${res.status} for ${url}`);
  return res.json() as Promise<T>;
}

async function fetchLeagueBundle(sleeperLeagueId: string) {
  const [league, rosters, users] = await Promise.all([
    fetchJson<SleeperLeague>(`${SLEEPER_BASE}/league/${sleeperLeagueId}`),
    fetchJson<SleeperRoster[]>(`${SLEEPER_BASE}/league/${sleeperLeagueId}/rosters`),
    fetchJson<SleeperUser[]>(`${SLEEPER_BASE}/league/${sleeperLeagueId}/users`),
  ]);
  return { league, rosters, users };
}

export async function listSleeperTeams(
  sleeperLeagueId: string
): Promise<{ leagueName: string; teams: SleeperTeamOption[] }> {
  const { league, rosters, users } = await fetchLeagueBundle(sleeperLeagueId);
  const userById = new Map(users.map((u) => [u.user_id, u]));
  const teams = rosters.map((r) => {
    const user = r.owner_id ? userById.get(r.owner_id) : undefined;
    return {
      rosterId: r.roster_id,
      ownerName: user?.display_name ?? `Roster ${r.roster_id}`,
      teamName: user?.metadata?.team_name ?? null,
      playerCount: r.players?.length ?? 0,
    };
  });
  return { leagueName: league.name, teams };
}

// This week's actual starting lineup for both sides of a matchup — separate
// from listSleeperTeams/buildDepthChartFromSleeper's "current roster" state,
// since a specific week's lineup (including past weeks) can differ from
// what's live right now. Feeds the weekly Enter Rosters flow instead of the
// persistent depth chart.
export async function fetchWeekMatchup(
  sleeperLeagueId: string,
  week: number,
  rosterId: number,
  lookup: (id: string) => PlayerRow | undefined = getPlayerById
): Promise<SleeperMatchupResult> {
  const [matchups, { teams }] = await Promise.all([
    fetchJson<SleeperMatchupEntry[]>(`${SLEEPER_BASE}/league/${sleeperLeagueId}/matchups/${week}`),
    listSleeperTeams(sleeperLeagueId),
  ]);

  const mine = matchups.find((m) => m.roster_id === rosterId);
  if (!mine) throw new Error(`No matchup data for roster ${rosterId} in week ${week}`);

  const teamByRosterId = new Map(teams.map((t) => [t.rosterId, t]));
  const labelFor = (id: number) => {
    const t = teamByRosterId.get(id);
    return t ? teamLabel(t) : `Roster ${id}`;
  };

  const toPlayers = (ids: string[] | null): SleeperMatchupPlayer[] =>
    (ids ?? [])
      .filter((id) => id && id !== "0")
      .map((id) => {
        const p = lookup(id);
        return {
          playerId: id,
          displayName: p?.full_name ?? id,
          team: p?.team ?? null,
          position: p?.position ?? null,
        };
      });

  // Bye weeks (odd team count) leave a roster with no matchup_id/partner.
  const opponent =
    mine.matchup_id != null ? matchups.find((m) => m.matchup_id === mine.matchup_id && m.roster_id !== rosterId) : undefined;

  return {
    myLabel: labelFor(rosterId),
    opponentLabel: opponent ? labelFor(opponent.roster_id) : null,
    minePlayers: toPlayers(mine.starters),
    opponentPlayers: toPlayers(opponent?.starters ?? null),
  };
}

// Sleeper's roster_positions has one BN entry per bench slot but keeps IR
// and taxi slot counts as separate league settings, not in the array.
function settingsFromRosterPositions(positions: string[], reserveSlots: number, taxiSlots: number): DepthChartSettings {
  const settings: DepthChartSettings = {
    QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, K: 0, P: 0, DEF: 0,
    DL: 0, LB: 0, DB: 0, IDPFLEX: 0, BENCH: 0, IR: reserveSlots, TAXI: taxiSlots,
  };
  for (const pos of positions) {
    switch (pos) {
      case "QB": case "RB": case "WR": case "TE": case "K": case "DEF": case "DL": case "LB": case "DB":
        settings[pos]++;
        break;
      case "FLEX":
      case "SUPER_FLEX": // counts toward the shared flex pool's size, not a zone of its own
        settings.FLEX++;
        break;
      case "IDP_FLEX":
        settings.IDPFLEX++;
        break;
      case "BN":
        settings.BENCH++;
        break;
      // unrecognized slot types (rare custom positions) are dropped rather
      // than guessed at
    }
  }
  return settings;
}

// `playerPosition` (the mapped depth-chart position of whoever's actually in
// this slot) is what FLEX/SUPER_FLEX resolve against: there's no dedicated
// offense-flex zone — a flex-filling player lands in their own position's
// zone (a QB in a superflex slot shows in QB, a WR in a flex slot shows in
// WR), and "is this the extra one" is a display-time computation based on
// order within that zone. IDP FLEX keeps its own dedicated zone as-is.
function starterZoneForSlot(slot: string, playerPosition: string | null): string | null {
  switch (slot) {
    case "QB": case "RB": case "WR": case "TE": case "K": case "DEF": case "DL": case "LB": case "DB":
      return `starter-${slot}`;
    case "FLEX":
    case "SUPER_FLEX":
      return playerPosition ? `starter-${playerPosition}` : null;
    case "IDP_FLEX":
      return "starter-IDPFLEX";
    default:
      return null;
  }
}

function toDepthChartPlayer(playerId: string, zone: string, order: number, lookup: (id: string) => PlayerRow | undefined): DepthChartPlayer {
  const p = lookup(playerId);
  const position = mapToDepthChartPosition(p?.position ?? null) ?? p?.position ?? "?";
  return {
    id: uid(),
    playerId,
    name: p?.full_name ?? playerId,
    position,
    team: p?.team ?? null,
    injuryStatus: p?.injury_status ?? null,
    zone,
    order,
  };
}

export async function buildDepthChartFromSleeper(
  sleeperLeagueId: string,
  rosterId: number,
  lookup: (id: string) => PlayerRow | undefined = getPlayerById
): Promise<DepthChartData> {
  const { league, rosters } = await fetchLeagueBundle(sleeperLeagueId);
  const roster = rosters.find((r) => r.roster_id === rosterId);
  if (!roster) throw new Error(`No roster ${rosterId} in Sleeper league ${sleeperLeagueId}`);

  const positions = league.roster_positions ?? [];
  const settings = settingsFromRosterPositions(positions, league.settings?.reserve_slots ?? 0, league.settings?.taxi_slots ?? 0);

  const players: DepthChartPlayer[] = [];
  const placed = new Set<string>();
  const zoneOrder = new Map<string, number>();
  const nextOrder = (zone: string) => {
    const n = zoneOrder.get(zone) ?? 0;
    zoneOrder.set(zone, n + 1);
    return n;
  };

  // Starters: Sleeper's `starters` array lines up positionally with
  // `roster_positions`, so a player's actual slot (including which one is
  // filling FLEX vs. a dedicated position) is known exactly — no guessing.
  const starters = roster.starters ?? [];
  starters.forEach((playerId, i) => {
    if (!playerId || playerId === "0") return;
    const playerPosition = mapToDepthChartPosition(lookup(playerId)?.position ?? null);
    const zone = starterZoneForSlot(positions[i], playerPosition);
    if (!zone) return;
    players.push(toDepthChartPlayer(playerId, zone, nextOrder(zone), lookup));
    placed.add(playerId);
  });

  for (const playerId of roster.reserve ?? []) {
    if (placed.has(playerId)) continue;
    players.push(toDepthChartPlayer(playerId, "ir", nextOrder("ir"), lookup));
    placed.add(playerId);
  }
  for (const playerId of roster.taxi ?? []) {
    if (placed.has(playerId)) continue;
    players.push(toDepthChartPlayer(playerId, "taxi", nextOrder("taxi"), lookup));
    placed.add(playerId);
  }
  // Everything else rostered is bench, grouped by the player's own position.
  for (const playerId of roster.players ?? []) {
    if (placed.has(playerId)) continue;
    const p = lookup(playerId);
    const pos = mapToDepthChartPosition(p?.position ?? null) ?? "DEF";
    const zone = `backup-${pos}`;
    players.push(toDepthChartPlayer(playerId, zone, nextOrder(zone), lookup));
    placed.add(playerId);
  }

  return { settings, players };
}
