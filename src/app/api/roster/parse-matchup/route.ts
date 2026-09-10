import { NextRequest, NextResponse } from "next/server";
import { ensurePlayersFresh, getAllPlayersForMatching } from "@/lib/players";
import { parseMatchup } from "@/lib/parseRoster";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text } = body as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ labelA: "", labelB: "", rows: [], method: "alternating" });
  }
  await ensurePlayersFresh();
  const allPlayers = getAllPlayersForMatching();
  const result = parseMatchup(text, allPlayers);
  return NextResponse.json(result);
}
