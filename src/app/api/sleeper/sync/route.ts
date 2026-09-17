import { NextRequest, NextResponse } from "next/server";
import { ensurePlayersFresh } from "@/lib/players";
import { buildDepthChartFromSleeper } from "@/lib/sleeperSync";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { sleeperLeagueId, rosterId } = body as { sleeperLeagueId?: string; rosterId?: number };
  if (!sleeperLeagueId || typeof rosterId !== "number") {
    return NextResponse.json({ error: "sleeperLeagueId and rosterId are required" }, { status: 400 });
  }
  try {
    await ensurePlayersFresh();
    const data = await buildDepthChartFromSleeper(sleeperLeagueId, rosterId);
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to sync from Sleeper" },
      { status: 502 }
    );
  }
}
