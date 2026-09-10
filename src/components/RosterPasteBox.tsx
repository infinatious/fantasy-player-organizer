"use client";

import { useEffect, useRef, useState } from "react";
import { RowsEditor } from "./RowsEditor";
import { type ParsedLine, type Row, type SavedEntry, rowFromParsedLine, rowFromSavedEntry } from "./rosterRows";

export function RosterPasteBox({
  title,
  side,
  leagueId,
  seasonYear,
  weekNumber,
  opponentLabel,
  onOpponentLabelChange,
}: {
  title: string;
  side: "mine" | "opponent";
  leagueId: number;
  seasonYear: number;
  weekNumber: number;
  opponentLabel?: string;
  onOpponentLabelChange?: (v: string) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    const key = `${leagueId}-${side}-${seasonYear}-${weekNumber}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setStatus(null);
    (async () => {
      const res = await fetch(
        `/api/roster?season=${seasonYear}&week=${weekNumber}&leagueId=${leagueId}&side=${side}`
      );
      const data = await res.json();
      const entries: SavedEntry[] = data.entries ?? [];
      if (entries.length > 0) {
        setText(entries.map((e) => e.raw_text).join("\n"));
        setRows(entries.map(rowFromSavedEntry));
      } else {
        setText("");
        setRows([]);
      }
    })();
  }, [leagueId, side, seasonYear, weekNumber]);

  async function handleParse() {
    setParsing(true);
    setStatus(null);
    const res = await fetch("/api/roster/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    const lines: ParsedLine[] = data.lines ?? [];
    setRows(lines.map(rowFromParsedLine));
    setParsing(false);
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    await fetch("/api/roster", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leagueId,
        seasonYear,
        weekNumber,
        side,
        opponentLabel: opponentLabel ?? null,
        entries: rows.map((r) => ({
          rawLine: r.rawLine,
          playerId: r.playerId,
          displayName: r.displayName,
        })),
      }),
    });
    setSaving(false);
    setStatus(`Saved ${rows.length} player${rows.length === 1 ? "" : "s"}.`);
  }

  const unmatchedCount = rows.filter((r) => !r.playerId).length;

  return (
    <div className="flex flex-1 flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        {rows.length > 0 && (
          <span className="text-xs text-neutral-500">
            {rows.length} lines{unmatchedCount > 0 ? ` · ${unmatchedCount} need review` : ""}
          </span>
        )}
      </div>

      {side === "opponent" && (
        <input
          value={opponentLabel ?? ""}
          onChange={(e) => onOpponentLabelChange?.(e.target.value)}
          placeholder="Opponent's team/manager name (optional)"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      )}

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Paste ${side === "mine" ? "your" : "your opponent's"} roster here...`}
        rows={8}
        className="w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="flex gap-2">
        <button
          onClick={handleParse}
          disabled={parsing || !text.trim()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          {parsing ? "Parsing…" : "Parse"}
        </button>
        <button
          onClick={handleSave}
          disabled={saving || rows.length === 0}
          className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {status && <span className="self-center text-xs text-green-600">{status}</span>}
      </div>

      <RowsEditor rows={rows} onChange={setRows} />
    </div>
  );
}
