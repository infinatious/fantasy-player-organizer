"use client";

import { useState } from "react";
import { withBasePath } from "@/lib/basePath";

interface SleeperTeamOption {
  rosterId: number;
  ownerName: string;
  teamName: string | null;
  playerCount: number;
}

export interface SleeperMatchupPlayer {
  playerId: string;
  displayName: string;
  team: string | null;
  position: string | null;
}

export interface SleeperMatchupData {
  myLabel: string;
  opponentLabel: string | null;
  minePlayers: SleeperMatchupPlayer[];
  opponentPlayers: SleeperMatchupPlayer[];
}

export function SleeperMatchupModal({
  week,
  onSync,
  onClose,
}: {
  week: number;
  onSync: (data: SleeperMatchupData) => void;
  onClose: () => void;
}) {
  const [leagueId, setLeagueId] = useState("");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [teams, setTeams] = useState<SleeperTeamOption[]>([]);
  const [rosterId, setRosterId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function lookUp() {
    if (!leagueId.trim()) return;
    setLooking(true);
    setError(null);
    setTeams([]);
    setRosterId(null);
    try {
      const res = await fetch(withBasePath(`/api/sleeper/teams?sleeperLeagueId=${encodeURIComponent(leagueId.trim())}`));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      setLeagueName(json.leagueName);
      setTeams(json.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
    }
    setLooking(false);
  }

  async function sync() {
    if (rosterId === null) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(
        withBasePath(
          `/api/sleeper/matchup?sleeperLeagueId=${encodeURIComponent(leagueId.trim())}&rosterId=${rosterId}&week=${week}`
        )
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      onSync(json);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
    setSyncing(false);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-1 text-lg font-semibold">Sync Week {week} from Sleeper</h3>
        <p className="mb-3 text-xs text-neutral-500">
          Prototype — pulls both teams&apos; actual starting lineup for this week straight from Sleeper&apos;s
          public API. Find the league ID in your Sleeper league&apos;s URL: sleeper.com/leagues/
          <span className="font-mono">this-number</span>/...
        </p>

        <div className="flex gap-2">
          <input
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
            placeholder="Sleeper league ID"
            className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="button"
            onClick={lookUp}
            disabled={looking || !leagueId.trim()}
            className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
          >
            {looking ? "Looking up…" : "Look Up"}
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {teams.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-neutral-500">{leagueName} — which team is yours?</p>
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-neutral-200 p-1 dark:border-neutral-800">
              {teams.map((t) => (
                <li key={t.rosterId}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
                    <input
                      type="radio"
                      name="sleeper-matchup-roster"
                      checked={rosterId === t.rosterId}
                      onChange={() => setRosterId(t.rosterId)}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {t.teamName ? `${t.teamName} (${t.ownerName})` : t.ownerName}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">{t.playerCount} players</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
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
            onClick={sync}
            disabled={rosterId === null || syncing}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            {syncing ? "Syncing…" : "Fill In This Week"}
          </button>
        </div>
      </div>
    </div>
  );
}
