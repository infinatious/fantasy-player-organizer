import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "app.db");

declare global {
  var __fpoDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('sleeper', 'espn', 'yahoo')),
      weight INTEGER NOT NULL DEFAULT 5,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      search_name TEXT NOT NULL,
      team TEXT,
      position TEXT,
      status TEXT,
      injury_status TEXT,
      first_name TEXT,
      last_name TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_players_search_name ON players(search_name);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS games (
      season_year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      team TEXT NOT NULL,
      opponent TEXT NOT NULL,
      is_home INTEGER NOT NULL,
      kickoff_iso TEXT,
      timeslot TEXT,
      PRIMARY KEY (season_year, week_number, team)
    );

    CREATE TABLE IF NOT EXISTS roster_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      season_year INTEGER NOT NULL,
      week_number INTEGER NOT NULL,
      side TEXT NOT NULL CHECK (side IN ('mine', 'opponent')),
      opponent_label TEXT,
      raw_text TEXT NOT NULL,
      player_id TEXT REFERENCES players(player_id),
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_roster_lookup ON roster_entries(season_year, week_number, league_id, side);
  `);

  // CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
  // exists from before this field was introduced, so patch it in directly.
  const playerColumns = new Set(
    (db.prepare("PRAGMA table_info(players)").all() as { name: string }[]).map((c) => c.name)
  );
  if (!playerColumns.has("first_name")) db.exec("ALTER TABLE players ADD COLUMN first_name TEXT");
  if (!playerColumns.has("last_name")) db.exec("ALTER TABLE players ADD COLUMN last_name TEXT");

  const leagueColumns = new Set(
    (db.prepare("PRAGMA table_info(leagues)").all() as { name: string }[]).map((c) => c.name)
  );
  if (!leagueColumns.has("weight")) {
    db.exec("ALTER TABLE leagues ADD COLUMN weight INTEGER NOT NULL DEFAULT 5");
  }
}

export function getDb(): Database.Database {
  if (!global.__fpoDb) {
    global.__fpoDb = createConnection();
  }
  return global.__fpoDb;
}
