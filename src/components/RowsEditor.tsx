"use client";

import type { PlayerRow, Row } from "./rosterRows";

export function RowsEditor({
  rows,
  onChange,
  onMoveOut,
  moveLabel,
}: {
  rows: Row[];
  onChange: (updater: (prev: Row[]) => Row[]) => void;
  onMoveOut?: (index: number) => void;
  moveLabel?: string;
}) {
  // onChange takes an updater (React state-setter style) rather than a
  // computed array so that two updates queued within the same event (e.g.
  // runSearch below) always apply on top of each other instead of both
  // being computed from the same stale `rows` snapshot and clobbering one
  // another — that bug made it impossible to type into the search box.
  function updateRow(index: number, patch: Partial<Row>) {
    onChange((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    onChange((prev) => prev.filter((_, i) => i !== index));
  }

  async function runSearch(index: number, query: string) {
    if (query.trim().length < 2) {
      updateRow(index, { searchQuery: query, searchResults: [] });
      return;
    }
    updateRow(index, { searchQuery: query });
    const res = await fetch(`/api/players/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    updateRow(index, { searchResults: data.players ?? [] });
  }

  function pickPlayer(index: number, player: PlayerRow) {
    updateRow(index, {
      playerId: player.player_id,
      displayName: player.full_name,
      team: player.team,
      position: player.position,
      searchOpen: false,
      searchQuery: "",
      searchResults: [],
    });
  }

  function clearPlayer(index: number) {
    updateRow(index, { playerId: null, team: null, position: null, searchOpen: true });
  }

  if (rows.length === 0) return null;

  return (
    <ul className="divide-y divide-neutral-200 rounded border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {rows.map((row, index) => (
        <li key={index} className="flex flex-col gap-1.5 px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              {row.playerId ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{row.displayName}</span>
                  {row.position && (
                    <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {row.position} {row.team ?? ""}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-amber-600">Unmatched: “{row.rawLine}”</span>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              {row.playerId ? (
                <button
                  onClick={() => clearPlayer(index)}
                  className="text-xs text-neutral-500 hover:underline"
                >
                  change
                </button>
              ) : (
                <button
                  onClick={() => updateRow(index, { searchOpen: !row.searchOpen })}
                  className="text-xs text-blue-600 hover:underline"
                >
                  find player
                </button>
              )}
              <button onClick={() => removeRow(index)} className="text-xs text-red-600 hover:underline">
                remove
              </button>
              {onMoveOut && (
                <button onClick={() => onMoveOut(index)} className="text-xs text-neutral-500 hover:underline">
                  {moveLabel ?? "move"}
                </button>
              )}
            </div>
          </div>

          {row.candidates.length > 1 && !row.playerId && (
            <div className="flex flex-wrap gap-1">
              {row.candidates.map((c) => (
                <button
                  key={c.player_id}
                  onClick={() => pickPlayer(index, c)}
                  className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  {c.full_name} ({c.position} {c.team})
                </button>
              ))}
            </div>
          )}

          {row.searchOpen && (
            <div className="relative">
              <input
                autoFocus
                value={row.searchQuery}
                onChange={(e) => runSearch(index, e.target.value)}
                placeholder="Search player name…"
                className="w-full rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
              />
              {row.searchResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded border border-neutral-300 bg-white shadow dark:border-neutral-700 dark:bg-neutral-900">
                  {row.searchResults.map((p) => (
                    <li key={p.player_id}>
                      <button
                        onClick={() => pickPlayer(index, p)}
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
  );
}
