import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  if (!season) return NextResponse.json({ error: "season is required" }, { status: 400 });
  const db = getDb();
  const results = db
    .prepare("SELECT * FROM league_results WHERE season_year = ? ORDER BY week_number ASC")
    .all(parseInt(season, 10));
  return NextResponse.json({ results });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { leagueId, seasonYear, weekNumber, result } = body as {
    leagueId?: number;
    seasonYear?: number;
    weekNumber?: number;
    result?: "W" | "L" | "T" | null;
  };
  if (!leagueId || !seasonYear || !weekNumber) {
    return NextResponse.json({ error: "leagueId, seasonYear, and weekNumber are required" }, { status: 400 });
  }
  const db = getDb();

  if (!result) {
    db.prepare("DELETE FROM league_results WHERE league_id = ? AND season_year = ? AND week_number = ?").run(
      leagueId,
      seasonYear,
      weekNumber
    );
    return NextResponse.json({ ok: true });
  }

  if (!["W", "L", "T"].includes(result)) {
    return NextResponse.json({ error: "result must be W, L, or T" }, { status: 400 });
  }

  db.prepare(
    `INSERT INTO league_results (league_id, season_year, week_number, result, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(league_id, season_year, week_number) DO UPDATE SET result = excluded.result, updated_at = excluded.updated_at`
  ).run(leagueId, seasonYear, weekNumber, result);

  return NextResponse.json({ ok: true });
}
