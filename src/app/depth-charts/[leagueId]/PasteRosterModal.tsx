"use client";

import { useState } from "react";
import { POSITIONS, mapToDepthChartPosition, type DepthChartSettings } from "@/lib/depthChart";
import type { PlayerRow } from "@/lib/players";

const SETTINGS_LABELS: Record<keyof DepthChartSettings, string> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  FLEX: "FLEX",
  K: "K",
  P: "P",
  DEF: "DEF",
  DL: "DL",
  LB: "LB",
  DB: "DB",
  IDPFLEX: "IDP FLEX",
  BENCH: "Bench",
  IR: "IR",
  TAXI: "Taxi",
};

interface ParsedLine {
  rawLine: string;
  match: PlayerRow | null;
  candidates: PlayerRow[];
}

interface PasteRow {
  id: string;
  include: boolean;
  rawLine: string;
  playerId: string | null;
  name: string;
  team: string | null;
  position: string | null;
  injuryStatus: string | null;
  candidates: PlayerRow[];
  searchOpen: boolean;
  searchQuery: string;
  searchResults: PlayerRow[];
}

function rowFromParsedLine(line: ParsedLine, idx: number): PasteRow {
  const mappedPos = mapToDepthChartPosition(line.match?.position ?? null);
  return {
    id: `row_${idx}`,
    include: !!line.match && !!mappedPos,
    rawLine: line.rawLine,
    playerId: line.match?.player_id ?? null,
    name: line.match?.full_name ?? line.rawLine,
    team: line.match?.team ?? null,
    position: mappedPos,
    injuryStatus: line.match?.injury_status ?? null,
    candidates: line.candidates,
    searchOpen: false,
    searchQuery: "",
    searchResults: [],
  };
}

export interface ImportItem {
  name: string;
  position: string;
  team: string | null;
  playerId: string | null;
  injuryStatus: string | null;
}

export function PasteRosterModal({
  settings,
  onImport,
  onClose,
}: {
  settings: DepthChartSettings;
  onImport: (items: ImportItem[], destination: string, detectedSettings?: Partial<DepthChartSettings>) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<PasteRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [destination, setDestination] = useState("backup");
  const [detectedSettings, setDetectedSettings] = useState<Partial<DepthChartSettings>>({});
  const [applySettings, setApplySettings] = useState(true);

  function updateRow(id: string, patch: Partial<PasteRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleParse() {
    if (!text.trim()) return;
    setParsing(true);
    const res = await fetch("/api/roster/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    const lines: ParsedLine[] = data.lines ?? [];
    // A matched row whose position has zero slots configured for this league
    // (most commonly IDP, or now the punter, since both default to off) has
    // nowhere on the board to land — drop it rather than surface noise the
    // user would just have to uncheck. Unmatched rows are left in for manual
    // review since we don't yet know what position they'd even be.
    const relevant = lines.filter((line) => {
      const pos = mapToDepthChartPosition(line.match?.position ?? null);
      if (!pos) return true;
      return (settings[pos as keyof DepthChartSettings] ?? 0) > 0;
    });
    setRows(relevant.map(rowFromParsedLine));
    setDetectedSettings(data.detectedSettings ?? {});
    setParsing(false);
  }

  async function runSearch(id: string, query: string) {
    updateRow(id, { searchQuery: query });
    if (query.trim().length < 2) {
      updateRow(id, { searchResults: [] });
      return;
    }
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    updateRow(id, { searchResults: data.players ?? [] });
  }

  function pickPlayer(id: string, player: PlayerRow) {
    updateRow(id, {
      playerId: player.player_id,
      name: player.full_name,
      team: player.team,
      position: mapToDepthChartPosition(player.position),
      injuryStatus: player.injury_status,
      include: true,
      candidates: [],
      searchOpen: false,
      searchQuery: "",
      searchResults: [],
    });
  }

  const includedCount = rows.filter((r) => r.include).length;

  const hasDetectedSettings = Object.keys(detectedSettings).length > 0;

  function handleImportClick() {
    const usable = rows.filter((r) => r.include && r.position && r.name.trim());
    onImport(
      usable.map((r) => ({
        name: r.name.trim(),
        position: r.position!,
        team: r.team,
        playerId: r.playerId,
        injuryStatus: r.injuryStatus,
      })),
      destination,
      applySettings && hasDetectedSettings ? detectedSettings : undefined
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-1 text-lg font-semibold">Paste Roster</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Paste an excerpt from Sleeper, ESPN, or Yahoo! — we&apos;ll try to match each line to a known player.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste roster text here…"
          rows={6}
          className="w-full rounded border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            {parsing ? "Parsing…" : "Parse"}
          </button>
          {rows.length > 0 && (
            <span className="text-xs text-neutral-500">
              {rows.length} line{rows.length === 1 ? "" : "s"} found · {includedCount} selected
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <ul className="mt-3 flex-1 space-y-1 overflow-y-auto rounded border border-neutral-200 p-1 dark:border-neutral-800">
              {rows.map((row) => (
                <li key={row.id} className="rounded px-2 py-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={(e) => updateRow(row.id, { include: e.target.checked })}
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      {row.playerId ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium">{row.name}</span>
                          {row.team && <span className="text-xs text-neutral-500">{row.team}</span>}
                        </div>
                      ) : (
                        <span className="truncate text-amber-600" title={row.rawLine}>
                          Unmatched: &ldquo;{row.rawLine}&rdquo;
                        </span>
                      )}
                    </div>
                    <select
                      value={row.position ?? ""}
                      onChange={(e) => updateRow(row.id, { position: e.target.value || null, include: true })}
                      className="shrink-0 rounded border border-neutral-300 px-1.5 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                    >
                      <option value="">Position…</option>
                      {POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    {row.playerId ? (
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { playerId: null, searchOpen: true })}
                        className="shrink-0 text-xs text-neutral-500 hover:underline"
                      >
                        change
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateRow(row.id, { searchOpen: !row.searchOpen })}
                        className="shrink-0 text-xs text-blue-600 hover:underline"
                      >
                        find player
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="shrink-0 text-xs text-red-600 hover:underline"
                    >
                      remove
                    </button>
                  </div>

                  {row.candidates.length > 1 && !row.playerId && (
                    <div className="mt-1 flex flex-wrap gap-1 pl-6">
                      {row.candidates.map((c) => (
                        <button
                          key={c.player_id}
                          type="button"
                          onClick={() => pickPlayer(row.id, c)}
                          className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                        >
                          {c.full_name} ({c.position} {c.team})
                        </button>
                      ))}
                    </div>
                  )}

                  {row.searchOpen && (
                    <div className="relative mt-1 pl-6">
                      <input
                        autoFocus
                        value={row.searchQuery}
                        onChange={(e) => runSearch(row.id, e.target.value)}
                        placeholder="Search player name…"
                        className="w-full rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      />
                      {row.searchResults.length > 0 && (
                        <ul className="absolute z-10 mt-1 w-full rounded border border-neutral-300 bg-white shadow dark:border-neutral-700 dark:bg-neutral-900">
                          {row.searchResults.map((p) => (
                            <li key={p.player_id}>
                              <button
                                type="button"
                                onClick={() => pickPlayer(row.id, p)}
                                className="block w-full px-2 py-1 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              >
                                {p.full_name} — {p.position} {p.team}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-neutral-500">Add selected players to</span>
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="backup">Backups (by position)</option>
                <option value="stash">Stashes (by position)</option>
                <option value="taxi">Taxi Squad</option>
                <option value="ir">Injured Reserve</option>
                <option value="cut">Cut / Trade Block</option>
              </select>
            </label>
            <p className="mt-1 text-[11px] text-neutral-500">
              Everything lands here first — drag players into starting lineup slots afterward. Unchecked or
              position-less rows won&apos;t be imported.
            </p>

            {hasDetectedSettings && (
              <label className="mt-3 flex items-start gap-2 rounded border border-neutral-200 p-2 text-xs dark:border-neutral-800">
                <input
                  type="checkbox"
                  checked={applySettings}
                  onChange={(e) => setApplySettings(e.target.checked)}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  <span className="font-medium">Detected roster shape:</span>{" "}
                  {(Object.entries(detectedSettings) as [keyof DepthChartSettings, number][])
                    .map(([k, v]) => `${v} ${SETTINGS_LABELS[k]}`)
                    .join(" · ")}
                  . Update this league&apos;s starter/bench settings to match.
                </span>
              </label>
            )}
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={includedCount === 0}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            Add {includedCount || ""} Player{includedCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}
