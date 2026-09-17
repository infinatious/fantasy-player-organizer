import { NextRequest, NextResponse } from "next/server";
import { ensurePlayersFresh } from "@/lib/players";
import { fetchWeekMatchup } from "@/lib/sleeperSync";

export async function GET(req: NextRequest) {
  const sleeperLeagueId = req.nextUrl.searchParams.get("sleeperLeagueId")?.trim();
  const rosterIdRaw = req.nextUrl.searchParams.get("rosterId");
  const weekRaw = req.nextUrl.searchParams.get("week");
  const rosterId = rosterIdRaw ? parseInt(rosterIdRaw, 10) : NaN;
  const week = weekRaw ? parseInt(weekRaw, 10) : NaN;
  if (!sleeperLeagueId || isNaN(rosterId) || isNaN(week)) {
    return NextResponse.json({ error: "sleeperLeagueId, rosterId, and week are required" }, { status: 400 });
  }
  try {
    await ensurePlayersFresh();
    const result = await fetchWeekMatchup(sleeperLeagueId, week, rosterId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch matchup" },
      { status: 502 }
    );
  }
}
