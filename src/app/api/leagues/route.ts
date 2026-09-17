import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();
  const leagues = db.prepare("SELECT * FROM leagues ORDER BY created_at ASC").all();
  return NextResponse.json({ leagues });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, platform, weight, team_name, sleeper_league_id, sleeper_roster_id } = body as {
    name?: string;
    platform?: string;
    weight?: number;
    team_name?: string;
    sleeper_league_id?: string | null;
    sleeper_roster_id?: number | null;
  };
  if (!name || !platform) {
    return NextResponse.json({ error: "name and platform are required" }, { status: 400 });
  }
  if (!["sleeper", "espn", "yahoo"].includes(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO leagues (name, platform, weight, team_name, sleeper_league_id, sleeper_roster_id) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      name.trim(),
      platform,
      weight ?? 5,
      team_name?.trim() || null,
      sleeper_league_id?.trim() || null,
      sleeper_roster_id ?? null
    );
  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json({ league }, { status: 201 });
}
