import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDepthChart, saveDepthChart } from "@/lib/depthChartDb";
import { normalizeDepthChartData } from "@/lib/depthChart";

export async function GET(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const id = parseInt(leagueId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "invalid league id" }, { status: 400 });
  const data = getDepthChart(id);
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const id = parseInt(leagueId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "invalid league id" }, { status: 400 });

  const db = getDb();
  const league = db.prepare("SELECT id FROM leagues WHERE id = ?").get(id);
  if (!league) return NextResponse.json({ error: "league not found" }, { status: 404 });

  const body = await req.json();
  const data = normalizeDepthChartData(body);
  saveDepthChart(id, data);
  return NextResponse.json({ data });
}
