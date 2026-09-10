import { NextRequest, NextResponse } from "next/server";
import { getWeekSchedule } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const week = req.nextUrl.searchParams.get("week");
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }
  try {
    const games = await getWeekSchedule(parseInt(season, 10), parseInt(week, 10), force);
    return NextResponse.json({ games });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to fetch schedule" },
      { status: 502 }
    );
  }
}
