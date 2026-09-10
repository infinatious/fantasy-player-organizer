import { NextRequest, NextResponse } from "next/server";
import { searchPlayers } from "@/lib/players";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const players = searchPlayers(q);
  return NextResponse.json({ players });
}
