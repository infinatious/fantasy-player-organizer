"use client";

import { useEffect, useRef, useState } from "react";
import { RowsEditor } from "./RowsEditor";
import { type ParsedLine, type Row, rowFromParsedLine, rowFromSavedEntry } from "./rosterRows";

interface SavedEntryWithOpponent {
  raw_text: string;
  player_id: string | null;
  display_name: string;
  team: string | null;
  position: string | null;
  opponent_label: string | null;
}

interface MatchupApiRow extends ParsedLine {
  side: 0 | 1;
}

export function MatchupEntry({
  leagueId,
  seasonYear,
  weekNumber,
}: {
  leagueId: number;
  seasonYear: number;
  weekNumber: number;
}) {
  const [text, setText] = useState("");
  const [panelA, setPanelA] = useState<Row[] | null>(null);
  const [panelB, setPanelB] = useState<Row[] | null>(null);
  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");
  const [mineIndex, setMineIndex] = useState<0 | 1>(0);
  const [opponentLabel, setOpponentLabel] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);

  const panels: [Row[], Row[]] | null = panelA && panelB ? [panelA, panelB] : null;
  const setPanel = [setPanelA, setPanelB];

  useEffect(() => {
    const key = `${leagueId}-${seasonYear}-${weekNumber}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setStatus(null);
    setWarning(null);
    setText("");
    (async () => {
      const [mineRes, oppRes] = await Promise.all([
        fetch(`/api/roster?season=${seasonYear}&week=${weekNumber}&leagueId=${leagueId}&side=mine`),
        fetch(`/api/roster?season=${seasonYear}&week=${weekNumber}&leagueId=${leagueId}&side=opponent`),
      ]);
      const mineData = await mineRes.json();
      const oppData = await oppRes.json();
      const mineEntries: SavedEntryWithOpponent[] = mineData.entries ?? [];
      const oppEntries: SavedEntryWithOpponent[] = oppData.entries ?? [];
      if (mineEntries.length > 0 || oppEntries.length > 0) {
        setPanelA(mineEntries.map(rowFromSavedEntry));
        setPanelB(oppEntries.map(rowFromSavedEntry));
        setLabelA("My Team");
        setLabelB(oppEntries[0]?.opponent_label || "Opponent");
        setMineIndex(0);
        setOpponentLabel(oppEntries[0]?.opponent_label || "");
      } else {
        setPanelA(null);
        setPanelB(null);
      }
    })();
  }, [leagueId, seasonYear, weekNumber]);

  function markAsMine(index: 0 | 1) {
    setMineIndex(index);
    const otherLabel = index === 0 ? labelB : labelA;
    setOpponentLabel(otherLabel);
  }

  async function handleParse() {
    setParsing(true);
    setStatus(null);
    setWarning(null);
    const res = await fetch("/api/roster/parse-matchup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data: { labelA: string; labelB: string; rows: MatchupApiRow[]; method: "header-split" | "alternating" } =
      await res.json();

    if (data.rows.length === 0) {
      setWarning("Couldn't find any recognizable players in this paste. Check the paste, or try “Paste Separately”.");
      setPanelA(null);
      setPanelB(null);
      setParsing(false);
      return;
    }

    setPanelA(data.rows.filter((r) => r.side === 0).map(rowFromParsedLine));
    setPanelB(data.rows.filter((r) => r.side === 1).map(rowFromParsedLine));
    setLabelA(data.labelA);
    setLabelB(data.labelB);
    setMineIndex(0);
    setOpponentLabel(data.labelB);

    if (data.method === "alternating") {
      setWarning(
        "Couldn't find explicit team headers in this paste, so players were split by guessing alternating rows. Double-check each side below and use “move” on any player that's on the wrong team."
      );
    }
    setParsing(false);
  }

  function movePlayer(fromIndex: 0 | 1, rowIndex: number) {
    const toIndex = fromIndex === 0 ? 1 : 0;
    const fromRows = fromIndex === 0 ? panelA : panelB;
    if (!fromRows) return;
    const moved = fromRows[rowIndex];
    setPanel[fromIndex]((prev) => (prev ? prev.filter((_, i) => i !== rowIndex) : prev));
    setPanel[toIndex]((prev) => (prev ? [...prev, moved] : [moved]));
  }

  async function handleSave() {
    if (!panels) return;
    setSaving(true);
    setStatus(null);
    const opponentIndex = mineIndex === 0 ? 1 : 0;
    await Promise.all([
      fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          seasonYear,
          weekNumber,
          side: "mine",
          opponentLabel: null,
          entries: panels[mineIndex].map((r) => ({
            rawLine: r.rawLine,
            playerId: r.playerId,
            displayName: r.displayName,
          })),
        }),
      }),
      fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId,
          seasonYear,
          weekNumber,
          side: "opponent",
          opponentLabel: opponentLabel || (mineIndex === 0 ? labelB : labelA),
          entries: panels[opponentIndex].map((r) => ({
            rawLine: r.rawLine,
            playerId: r.playerId,
            displayName: r.displayName,
          })),
        }),
      }),
    ]);
    setSaving(false);
    const total = panels[0].length + panels[1].length;
    setStatus(`Saved ${total} players across both teams.`);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="mb-1 block text-sm font-medium">Paste the full matchup (both teams)</label>
        <p className="mb-2 text-xs text-neutral-500">
          Copy your platform&apos;s matchup/box-score view — the one that shows your team and your
          opponent&apos;s team together — and paste the whole thing here.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the full matchup here..."
          rows={8}
          className="w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            {parsing ? "Parsing…" : "Parse Matchup"}
          </button>
        </div>
        {warning && <p className="mt-2 text-sm text-amber-600">{warning}</p>}
      </div>

      {panels && (
        <>
          <div className="flex flex-col gap-4 md:flex-row">
            {([0, 1] as const).map((index) => {
              const isMine = index === mineIndex;
              const label = index === 0 ? labelA : labelB;
              const rows = panels[index];
              return (
                <div
                  key={index}
                  className="flex flex-1 flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-medium">{isMine ? "My Team" : "Opponent"}</h2>
                      <p className="text-xs text-neutral-500">
                        {label} · {rows.length} player{rows.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      onClick={() => markAsMine(index)}
                      disabled={isMine}
                      className="shrink-0 rounded border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-neutral-700"
                    >
                      {isMine ? "This is mine" : "Mark as mine"}
                    </button>
                  </div>
                  {!isMine && (
                    <input
                      value={opponentLabel}
                      onChange={(e) => setOpponentLabel(e.target.value)}
                      placeholder="Opponent's team/manager name (optional)"
                      className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  )}
                  <RowsEditor
                    rows={rows}
                    onChange={(updater) => setPanel[index]((prev) => updater(prev ?? []))}
                    onMoveOut={(rowIndex) => movePlayer(index, rowIndex)}
                    moveLabel={isMine ? "→ opponent" : "→ mine"}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {saving ? "Saving…" : "Save Both Teams"}
            </button>
            {status && <span className="text-xs text-green-600">{status}</span>}
          </div>
        </>
      )}
    </div>
  );
}
