import { getDb } from "./db";
import { getCachedWeekSchedule } from "./schedule";

const TIMESLOT_ORDER = [
  "Wednesday Night",
  "Thursday Night",
  "Friday",
  "Saturday",
  "Sunday Morning (Intl)",
  "Sunday Early",
  "Sunday Late",
  "Sunday Night",
  "Monday Night",
  "Other",
  "Bye / No Game",
];

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "DL", "LB", "DB", "DEF", "K", "P"];

// IDP sub-positions and other variants collapse to their bucket for ordering.
const POSITION_ORDER_ALIAS: Record<string, string> = {
  FB: "RB",
  DE: "DL",
  DT: "DL",
  NT: "DL",
  ILB: "LB",
  OLB: "LB",
  CB: "DB",
  S: "DB",
  FS: "DB",
  SS: "DB",
  "K/P": "K",
};

function positionRank(position: string | null): number {
  if (!position) return POSITION_ORDER.length;
  const canonical = POSITION_ORDER_ALIAS[position] ?? position;
  const idx = POSITION_ORDER.indexOf(canonical);
  return idx === -1 ? POSITION_ORDER.length : idx;
}

interface RosterRow {
  id: number;
  league_id: number;
  league_name: string;
  league_weight: number;
  side: "mine" | "opponent";
  opponent_label: string | null;
  player_id: string | null;
  display_name: string;
  team: string | null;
  position: string | null;
  injury_status: string | null;
}

export interface DashboardLeagueRef {
  leagueId: number;
  leagueName: string;
  leagueWeight: number;
  side: "mine" | "opponent";
  opponentLabel: string | null;
}

export interface DashboardPlayer {
  playerId: string | null;
  name: string;
  team: string | null;
  position: string | null;
  injuryStatus: string | null;
  opponent: string | null;
  kickoffIso: string | null;
  // Weighted rooting score from -100 (root hard against — every league
  // weighs against you) to +100 (root hard for — every league weighs for
  // you), based on each league's importance weight.
  score: number;
  leagues: DashboardLeagueRef[];
}

export interface DashboardTeamGroup {
  // null groups players with no known team (e.g. a free agent).
  team: string | null;
  players: DashboardPlayer[];
}

export interface DashboardGame {
  // null for the "Bye / No Game" bucket, where there's no single game to
  // group by — everyone there just shares the timeslot.
  label: string | null;
  kickoffIso: string | null;
  teams: DashboardTeamGroup[];
}

export interface DashboardTimeslot {
  name: string;
  games: DashboardGame[];
}

export interface DashboardResult {
  timeslots: DashboardTimeslot[];
  unmatchedCount: number;
}

export function buildDashboard(seasonYear: number, weekNumber: number): DashboardResult {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT re.id, re.league_id, l.name as league_name, l.weight as league_weight, re.side, re.opponent_label,
              re.player_id, re.display_name, p.team, p.position, p.injury_status
       FROM roster_entries re
       JOIN leagues l ON l.id = re.league_id
       LEFT JOIN players p ON p.player_id = re.player_id
       WHERE re.season_year = ? AND re.week_number = ?`
    )
    .all(seasonYear, weekNumber) as RosterRow[];

  const schedule = getCachedWeekSchedule(seasonYear, weekNumber);
  const scheduleByTeam = new Map(schedule.map((g) => [g.team, g]));

  const unmatched = rows.filter((r) => !r.player_id);

  const byPlayer = new Map<
    string,
    { name: string; team: string | null; position: string | null; injuryStatus: string | null; leagues: DashboardLeagueRef[] }
  >();

  for (const r of rows) {
    if (!r.player_id) continue;
    const key = r.player_id;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        name: r.display_name,
        team: r.team,
        position: r.position,
        injuryStatus: r.injury_status,
        leagues: [],
      });
    }
    byPlayer.get(key)!.leagues.push({
      leagueId: r.league_id,
      leagueName: r.league_name,
      leagueWeight: r.league_weight,
      side: r.side,
      opponentLabel: r.opponent_label,
    });
  }

  // Games nested within each timeslot, keyed by the two teams involved so
  // both sides' rostered players land in the same group; players within a
  // game are further split out by which of the two teams they're on.
  interface GameAccumulator {
    label: string | null;
    kickoffIso: string | null;
    awayTeam: string | null;
    homeTeam: string | null;
    playersByTeam: Map<string | null, DashboardPlayer[]>;
  }
  const timeslotGames = new Map<string, Map<string, GameAccumulator>>();
  for (const name of TIMESLOT_ORDER) timeslotGames.set(name, new Map());

  for (const [playerId, info] of byPlayer.entries()) {
    const game = info.team ? scheduleByTeam.get(info.team) : undefined;
    const timeslot = game ? game.timeslot : "Bye / No Game";

    const mineWeight = info.leagues.filter((l) => l.side === "mine").reduce((sum, l) => sum + l.leagueWeight, 0);
    const oppWeight = info.leagues.filter((l) => l.side === "opponent").reduce((sum, l) => sum + l.leagueWeight, 0);

    // Ratio of "for" weight vs "against" weight, scaled to -100..+100. A
    // player who's only ever on your side scores +100 regardless of how
    // many leagues; one who's only ever an opponent scores -100. Splitting
    // time between both pulls the score toward 0, weighted by how much each
    // league matters (its weight) rather than a flat per-league count.
    const totalWeight = mineWeight + oppWeight;
    const score = totalWeight === 0 ? 0 : Math.round(((mineWeight - oppWeight) / totalWeight) * 100);

    const entry: DashboardPlayer = {
      playerId,
      name: info.name,
      team: info.team,
      position: info.position,
      injuryStatus: info.injuryStatus,
      opponent: game ? game.opponent : null,
      kickoffIso: game ? game.kickoffIso : null,
      score,
      leagues: info.leagues,
    };

    if (!timeslotGames.has(timeslot)) timeslotGames.set(timeslot, new Map());
    const gamesInSlot = timeslotGames.get(timeslot)!;

    const gameKey = game ? [game.team, game.opponent].sort().join("-") : "bye";
    if (!gamesInSlot.has(gameKey)) {
      const label = game ? (game.isHome ? `${game.opponent} @ ${game.team}` : `${game.team} @ ${game.opponent}`) : null;
      const awayTeam = game ? (game.isHome ? game.opponent : game.team) : null;
      const homeTeam = game ? (game.isHome ? game.team : game.opponent) : null;
      gamesInSlot.set(gameKey, {
        label,
        kickoffIso: game ? game.kickoffIso : null,
        awayTeam,
        homeTeam,
        playersByTeam: new Map(),
      });
    }
    const acc = gamesInSlot.get(gameKey)!;
    if (!acc.playersByTeam.has(entry.team)) acc.playersByTeam.set(entry.team, []);
    acc.playersByTeam.get(entry.team)!.push(entry);
  }

  for (const gamesInSlot of timeslotGames.values()) {
    for (const g of gamesInSlot.values()) {
      for (const players of g.playersByTeam.values()) {
        players.sort((a, b) => {
          const rankDiff = positionRank(a.position) - positionRank(b.position);
          return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name);
        });
      }
    }
  }

  const timeslots: DashboardTimeslot[] = TIMESLOT_ORDER.filter((name) => (timeslotGames.get(name)?.size ?? 0) > 0).map(
    (name) => {
      const games: DashboardGame[] = [...timeslotGames.get(name)!.values()]
        .sort((a, b) => {
          if (a.kickoffIso && b.kickoffIso && a.kickoffIso !== b.kickoffIso) {
            return a.kickoffIso.localeCompare(b.kickoffIso);
          }
          return (a.label ?? "").localeCompare(b.label ?? "");
        })
        .map((acc) => {
          // Away team's group first, then home, matching the "AWAY @ HOME"
          // label; any other team codes (mixed-team buckets like Bye) follow
          // alphabetically, with no-team players last.
          const priority = (team: string | null) => {
            if (team === acc.awayTeam) return 0;
            if (team === acc.homeTeam) return 1;
            if (team === null) return 3;
            return 2;
          };
          const teams: DashboardTeamGroup[] = [...acc.playersByTeam.entries()]
            .map(([team, players]) => ({ team, players }))
            .sort((a, b) => {
              const p = priority(a.team) - priority(b.team);
              if (p !== 0) return p;
              return (a.team ?? "").localeCompare(b.team ?? "");
            });
          return { label: acc.label, kickoffIso: acc.kickoffIso, teams };
        });
      return { name, games };
    }
  );

  return { timeslots, unmatchedCount: unmatched.length };
}

export interface LeagueEntryStatus {
  leagueId: number;
  leagueName: string;
  hasMine: boolean;
  hasOpponent: boolean;
}

// Per-league checklist for a given week: has this side been pasted in yet?
// Backs the "you haven't finished entering rosters this week" reminder.
export function getWeeklyEntryStatus(seasonYear: number, weekNumber: number): LeagueEntryStatus[] {
  const db = getDb();
  const leagues = db.prepare("SELECT id, name FROM leagues ORDER BY created_at ASC").all() as {
    id: number;
    name: string;
  }[];
  const rows = db
    .prepare("SELECT DISTINCT league_id, side FROM roster_entries WHERE season_year = ? AND week_number = ?")
    .all(seasonYear, weekNumber) as { league_id: number; side: "mine" | "opponent" }[];

  const sidesByLeague = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!sidesByLeague.has(r.league_id)) sidesByLeague.set(r.league_id, new Set());
    sidesByLeague.get(r.league_id)!.add(r.side);
  }

  return leagues.map((l) => ({
    leagueId: l.id,
    leagueName: l.name,
    hasMine: sidesByLeague.get(l.id)?.has("mine") ?? false,
    hasOpponent: sidesByLeague.get(l.id)?.has("opponent") ?? false,
  }));
}
