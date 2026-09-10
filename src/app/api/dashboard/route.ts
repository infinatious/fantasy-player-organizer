import { NextRequest, NextResponse } from "next/server";
import { buildDashboard } from "@/lib/dashboard";
import { getWeekSchedule } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const week = req.nextUrl.searchParams.get("week");
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }
  const seasonYear = parseInt(season, 10);
  const weekNumber = parseInt(week, 10);
  try {
    await getWeekSchedule(seasonYear, weekNumber);
  } catch {
    // Fall back to whatever is cached (or empty) so the dashboard still
    // renders; the user can retry via "Refresh Schedule".
  }
  const result = buildDashboard(seasonYear, weekNumber);
  return NextResponse.json(result);
}
