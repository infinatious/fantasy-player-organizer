import { getDb } from "./db";
import { classifyTimeslot } from "./weekUtils";

export { classifyTimeslot } from "./weekUtils";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

export interface TeamGame {
  team: string;
  opponent: string;
  isHome: boolean;
  kickoffIso: string | null;
  timeslot: string;
}

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { abbreviation: string };
}

interface EspnEvent {
  date: string;
  competitions: {
    competitors: EspnCompetitor[];
  }[];
}

interface EspnScoreboardResponse {
  events: EspnEvent[];
}

// Normalize a couple of abbreviation mismatches between ESPN and Sleeper.
const TEAM_ABBR_ALIASES: Record<string, string> = {
  WSH: "WAS",
  JAX: "JAX",
  LAR: "LAR",
};

function normalizeTeamAbbr(abbr: string): string {
  return TEAM_ABBR_ALIASES[abbr] ?? abbr;
}

export async function refreshWeekSchedule(
  seasonYear: number,
  weekNumber: number
): Promise<TeamGame[]> {
  const url = `${ESPN_SCOREBOARD_URL}?week=${weekNumber}&year=${seasonYear}&seasontype=2`;
  // ESPN's edge (Akamai) blocks Node's default fetch User-Agent with a 403;
  // a plain curl-style UA is allowed through.
  const res = await fetch(url, { headers: { "User-Agent": "curl/8.5.0", Accept: "*/*" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch schedule: ${res.status}`);
  }
  const data = (await res.json()) as EspnScoreboardResponse;

  const games: TeamGame[] = [];
  for (const event of data.events ?? []) {
    const competitors = event.competitions?.[0]?.competitors ?? [];
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const homeAbbr = normalizeTeamAbbr(home.team.abbreviation);
    const awayAbbr = normalizeTeamAbbr(away.team.abbreviation);
    const timeslot = classifyTimeslot(event.date);
    games.push({ team: homeAbbr, opponent: awayAbbr, isHome: true, kickoffIso: event.date, timeslot });
    games.push({ team: awayAbbr, opponent: homeAbbr, isHome: false, kickoffIso: event.date, timeslot });
  }

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO games (season_year, week_number, team, opponent, is_home, kickoff_iso, timeslot)
    VALUES (@season_year, @week_number, @team, @opponent, @is_home, @kickoff_iso, @timeslot)
    ON CONFLICT(season_year, week_number, team) DO UPDATE SET
      opponent = excluded.opponent,
      is_home = excluded.is_home,
      kickoff_iso = excluded.kickoff_iso,
      timeslot = excluded.timeslot
  `);
  const tx = db.transaction((rows: TeamGame[]) => {
    for (const g of rows) {
      insert.run({
        season_year: seasonYear,
        week_number: weekNumber,
        team: g.team,
        opponent: g.opponent,
        is_home: g.isHome ? 1 : 0,
        kickoff_iso: g.kickoffIso,
        timeslot: g.timeslot,
      });
    }
  });
  tx(games);

  return games;
}

export function getCachedWeekSchedule(seasonYear: number, weekNumber: number): TeamGame[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT team, opponent, is_home, kickoff_iso, timeslot FROM games WHERE season_year = ? AND week_number = ?"
    )
    .all(seasonYear, weekNumber) as {
    team: string;
    opponent: string;
    is_home: number;
    kickoff_iso: string | null;
    timeslot: string;
  }[];
  return rows.map((r) => ({
    team: r.team,
    opponent: r.opponent,
    isHome: !!r.is_home,
    kickoffIso: r.kickoff_iso,
    timeslot: r.timeslot,
  }));
}

export async function getWeekSchedule(
  seasonYear: number,
  weekNumber: number,
  force = false
): Promise<TeamGame[]> {
  if (!force) {
    const cached = getCachedWeekSchedule(seasonYear, weekNumber);
    if (cached.length > 0) return cached;
  }
  return refreshWeekSchedule(seasonYear, weekNumber);
}
