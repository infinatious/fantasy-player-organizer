"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/basePath";

interface SleeperTeamOption {
  rosterId: number;
  ownerName: string;
  teamName: string | null;
  playerCount: number;
}

// Lets a league be linked to a real Sleeper league + "which roster is mine"
// once, here, instead of re-entering it every time you want to sync a depth
// chart or a week's matchup — those flows just read the saved values.
export function SleeperConnectionFields({
  sleeperLeagueId,
  sleeperRosterId,
  onChange,
}: {
  sleeperLeagueId: string;
  sleeperRosterId: number | null;
  onChange: (next: { sleeperLeagueId: string; sleeperRosterId: number | null }) => void;
}) {
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const [teams, setTeams] = useState<SleeperTeamOption[]>([]);

  async function lookUp(id: string) {
    if (!id.trim()) return;
    setLooking(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/sleeper/teams?sleeperLeagueId=${encodeURIComponent(id.trim())}`));
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      setLeagueName(json.leagueName);
      setTeams(json.teams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lookup failed");
      setTeams([]);
    }
    setLooking(false);
  }

  // Resolve the friendly team name once on open for an already-connected
  // league, so it doesn't look unconfigured just because the picker list
  // hasn't been fetched yet this session.
  useEffect(() => {
    if (sleeperLeagueId && sleeperRosterId !== null) {
      lookUp(sleeperLeagueId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="mb-2 text-xs font-medium text-neutral-500">
        Sleeper connection (optional) — lets depth chart &amp; matchup sync skip straight to the data.
      </p>
      <div className="flex gap-2">
        <input
          value={sleeperLeagueId}
          onChange={(e) => onChange({ sleeperLeagueId: e.target.value, sleeperRosterId: null })}
          placeholder="Sleeper league ID"
          className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="button"
          onClick={() => lookUp(sleeperLeagueId)}
          disabled={looking || !sleeperLeagueId.trim()}
          className="shrink-0 rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          {looking ? "Looking up…" : "Look Up"}
        </button>
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {teams.length > 0 && (
        <div className="mt-2">
          <p className="mb-1 text-xs text-neutral-500">{leagueName} — which team is yours?</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-neutral-200 p-1 dark:border-neutral-800">
            {teams.map((t) => (
              <li key={t.rosterId}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <input
                    type="radio"
                    name="sleeper-roster-pick"
                    checked={sleeperRosterId === t.rosterId}
                    onChange={() => onChange({ sleeperLeagueId, sleeperRosterId: t.rosterId })}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {t.teamName ? `${t.teamName} (${t.ownerName})` : t.ownerName}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sleeperLeagueId && sleeperRosterId !== null && teams.length === 0 && !looking && !error && (
        <p className="mt-1 text-xs text-neutral-500">Linked to roster #{sleeperRosterId}.</p>
      )}
    </div>
  );
}
