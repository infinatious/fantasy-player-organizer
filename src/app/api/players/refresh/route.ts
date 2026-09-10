import { NextResponse } from "next/server";
import { refreshPlayers, getPlayerCacheAge } from "@/lib/players";

export async function POST() {
  const result = await refreshPlayers();
  return NextResponse.json(result);
}

export async function GET() {
  const age = getPlayerCacheAge();
  return NextResponse.json({ ageMs: age });
}
