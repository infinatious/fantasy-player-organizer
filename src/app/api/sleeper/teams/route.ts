import { NextRequest, NextResponse } from "next/server";
import { listSleeperTeams } from "@/lib/sleeperSync";

export async function GET(req: NextRequest) {
  const sleeperLeagueId = req.nextUrl.searchParams.get("sleeperLeagueId")?.trim();
  if (!sleeperLeagueId) {
    return NextResponse.json({ error: "sleeperLeagueId is required" }, { status: 400 });
  }
  try {
    const result = await listSleeperTeams(sleeperLeagueId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reach Sleeper" },
      { status: 502 }
    );
  }
}
