import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.prepare("DELETE FROM leagues WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { name, platform, weight, team_name, sleeper_league_id, sleeper_roster_id } = body as {
    name?: string;
    platform?: string;
    weight?: number;
    team_name?: string | null;
    sleeper_league_id?: string | null;
    sleeper_roster_id?: number | null;
  };
  const db = getDb();
  const existing = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id) as
    | {
        name: string;
        platform: string;
        weight: number;
        team_name: string | null;
        sleeper_league_id: string | null;
        sleeper_roster_id: number | null;
      }
    | undefined;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  db.prepare(
    `UPDATE leagues SET name = ?, platform = ?, weight = ?, team_name = ?, sleeper_league_id = ?, sleeper_roster_id = ?
     WHERE id = ?`
  ).run(
    name?.trim() || existing.name,
    platform || existing.platform,
    weight ?? existing.weight,
    team_name !== undefined ? team_name?.trim() || null : existing.team_name,
    sleeper_league_id !== undefined ? sleeper_league_id?.trim() || null : existing.sleeper_league_id,
    sleeper_roster_id !== undefined ? sleeper_roster_id : existing.sleeper_roster_id,
    id
  );
  const league = db.prepare("SELECT * FROM leagues WHERE id = ?").get(id);
  return NextResponse.json({ league });
}
