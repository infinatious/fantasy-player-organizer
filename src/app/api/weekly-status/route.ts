import { NextRequest, NextResponse } from "next/server";
import { getWeeklyEntryStatus } from "@/lib/dashboard";

export async function GET(req: NextRequest) {
  const season = req.nextUrl.searchParams.get("season");
  const week = req.nextUrl.searchParams.get("week");
  if (!season || !week) {
    return NextResponse.json({ error: "season and week are required" }, { status: 400 });
  }
  const leagues = getWeeklyEntryStatus(parseInt(season, 10), parseInt(week, 10));
  return NextResponse.json({ leagues });
}
