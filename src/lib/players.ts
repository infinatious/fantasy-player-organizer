import { getDb } from "./db";
import { normalizeName } from "./normalize";

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24; // 1 day

const FANTASY_POSITIONS = new Set([
  "QB",
  "RB",
  "WR",
  "TE",
  "FB",
  "K",
  "P",
  "K/P",
  "DEF",
  // IDP (individual defensive player) positions — needed for IDP leagues.
  "DB",
  "CB",
  "S",
  "FS",
  "SS",
  "LB",
  "ILB",
  "OLB",
  "DL",
  "DE",
  "DT",
  "NT",
]);

interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string | null;
  position?: string | null;
  active?: boolean;
  status?: string | null;
  injury_status?: string | null;
}

export function getPlayerCacheAge(): number | null {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'players_fetched_at'")
    .get() as { value: string } | undefined;
  if (!row) return null;
  return Date.now() - new Date(row.value).getTime();
}

export async function ensurePlayersFresh(force = false): Promise<{ refreshed: boolean; count: number }> {
  const age = getPlayerCacheAge();
  if (!force && age !== null && age < REFRESH_INTERVAL_MS) {
    const db = getDb();
    const count = (db.prepare("SELECT COUNT(*) as c FROM players").get() as { c: number }).c;
    return { refreshed: false, count };
  }
  return refreshPlayers();
}

export async function refreshPlayers(): Promise<{ refreshed: boolean; count: number }> {
  const res = await fetch(SLEEPER_PLAYERS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Sleeper players: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, SleeperPlayer>;

  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO players (player_id, full_name, search_name, team, position, status, injury_status, first_name, last_name)
    VALUES (@player_id, @full_name, @search_name, @team, @position, @status, @injury_status, @first_name, @last_name)
    ON CONFLICT(player_id) DO UPDATE SET
      full_name = excluded.full_name,
      search_name = excluded.search_name,
      team = excluded.team,
      position = excluded.position,
      status = excluded.status,
      injury_status = excluded.injury_status,
      first_name = excluded.first_name,
      last_name = excluded.last_name
  `);

  let count = 0;
  const tx = db.transaction((players: SleeperPlayer[]) => {
    for (const p of players) {
      if (!p.position || !FANTASY_POSITIONS.has(p.position)) continue;
      let fullName = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ");
      if (p.position === "DEF") {
        // Sleeper defense entries use the full team name (e.g. "San Francisco
        // 49ers"), but pasted rosters almost always just say "49ers D/ST" or
        // "Niners DEF". Match on the mascot word alone.
        fullName = fullName.trim().split(/\s+/).pop() || fullName;
      }
      if (!fullName) continue;
      insert.run({
        player_id: p.player_id,
        full_name: fullName,
        search_name: normalizeName(fullName),
        team: p.team ?? null,
        position: p.position ?? null,
        status: p.status ?? null,
        injury_status: p.injury_status ?? null,
        first_name: p.first_name ?? null,
        last_name: p.last_name ?? null,
      });
      count++;
    }
  });
  tx(Object.values(data));

  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('players_fetched_at', @value) ON CONFLICT(key) DO UPDATE SET value = @value"
  ).run({ value: new Date().toISOString() });

  return { refreshed: true, count };
}

export interface PlayerRow {
  player_id: string;
  full_name: string;
  search_name: string;
  team: string | null;
  position: string | null;
  status: string | null;
  injury_status: string | null;
  first_name: string | null;
  last_name: string | null;
}

export function searchPlayers(query: string, limit = 15): PlayerRow[] {
  const db = getDb();
  const normalized = normalizeName(query);
  if (!normalized) return [];
  const like = `%${normalized}%`;
  return db
    .prepare(
      `SELECT * FROM players WHERE search_name LIKE ? ORDER BY
        CASE WHEN search_name = ? THEN 0 WHEN search_name LIKE ? THEN 1 ELSE 2 END,
        full_name ASC
       LIMIT ?`
    )
    .all(like, normalized, `${normalized}%`, limit) as PlayerRow[];
}

export function getAllPlayersForMatching(): PlayerRow[] {
  const db = getDb();
  return db.prepare("SELECT * FROM players").all() as PlayerRow[];
}

export function getPlayerById(playerId: string): PlayerRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM players WHERE player_id = ?").get(playerId) as
    | PlayerRow
    | undefined;
}
