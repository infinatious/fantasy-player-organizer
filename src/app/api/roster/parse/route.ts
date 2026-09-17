import { NextRequest, NextResponse } from "next/server";
import { ensurePlayersFresh, getAllPlayersForMatching } from "@/lib/players";
import { parseRosterText, inferSlotCounts } from "@/lib/parseRoster";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text } = body as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ lines: [], detectedSettings: {} });
  }
  await ensurePlayersFresh();
  const allPlayers = getAllPlayersForMatching();
  const lines = parseRosterText(text, allPlayers);
  const detectedSettings = inferSlotCounts(text);
  return NextResponse.json({ lines, detectedSettings });
}
