import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

interface RosterEntryInput {
  rawLine: string;
  playerId: string | null;
  displayName: string;
}

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const week = req.nextUrl.searchParams.get("week");
  const leagueId = req.nextUrl.searchParams.get("leagueId");
  const side = req.nextUrl.searchParams.get("side");
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }
  const db = getDb();
  let query = `SELECT re.*, l.name as league_name, p.full_name, p.team, p.position
               FROM roster_entries re
               JOIN leagues l ON l.id = re.league_id
               LEFT JOIN players p ON p.player_id = re.player_id
               WHERE re.season_year = ? AND re.week_number = ?`;
  const args: (string | number)[] = [parseInt(season, 10), parseInt(week, 10)];
  if (leagueId) {
    query += " AND re.league_id = ?";
    args.push(parseInt(leagueId, 10));
  }
  if (side) {
    query += " AND re.side = ?";
    args.push(side);
  }
  const entries = db.prepare(query).all(...args);
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leagueId, seasonYear, weekNumber, side, opponentLabel, entries } = body as {
    leagueId?: number;
    seasonYear?: number;
    weekNumber?: number;
    side?: "mine" | "opponent";
    opponentLabel?: string | null;
    entries?: RosterEntryInput[];
  };

  if (!leagueId || !seasonYear || !weekNumber || !side || !entries) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }
  if (side !== "mine" && side !== "opponent") {
    return NextResponse.json({ error: "invalid side" }, { status: 400 });
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      "DELETE FROM roster_entries WHERE league_id = ? AND season_year = ? AND week_number = ? AND side = ?"
    ).run(leagueId, seasonYear, weekNumber, side);

    const insert = db.prepare(`
      INSERT INTO roster_entries
        (league_id, season_year, week_number, side, opponent_label, raw_text, player_id, display_name)
      VALUES (@league_id, @season_year, @week_number, @side, @opponent_label, @raw_text, @player_id, @display_name)
    `);
    for (const e of entries) {
      insert.run({
        league_id: leagueId,
        season_year: seasonYear,
        week_number: weekNumber,
        side,
        opponent_label: opponentLabel || null,
        raw_text: e.rawLine,
        player_id: e.playerId,
        display_name: e.displayName,
      });
    }
  });
  tx();

  return NextResponse.json({ ok: true });
}
