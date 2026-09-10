"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSeasonWeek } from "@/context/SeasonWeekContext";
import { RosterPasteBox } from "@/components/RosterPasteBox";
import { MatchupEntry } from "@/components/MatchupEntry";

interface League {
  id: number;
  name: string;
  platform: string;
}

type Mode = "matchup" | "separate";

const LAST_LEAGUE_KEY = "fpo-last-league-id";

export default function EntryPage() {
  const { seasonYear, weekNumber } = useSeasonWeek();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [opponentLabel, setOpponentLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("matchup");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/leagues");
      const data = await res.json();
      setLeagues(data.leagues);
      if (data.leagues.length > 0) {
        let initial = data.leagues[0].id;
        try {
          const stored = localStorage.getItem(LAST_LEAGUE_KEY);
          const storedId = stored ? parseInt(stored, 10) : null;
          if (storedId && data.leagues.some((l: League) => l.id === storedId)) {
            initial = storedId;
          }
        } catch {
          // ignore malformed/inaccessible storage
        }
        setLeagueId(initial);
      }
      setLoading(false);
    })();
  }, []);

  function selectLeague(id: number) {
    setLeagueId(id);
    try {
      localStorage.setItem(LAST_LEAGUE_KEY, String(id));
    } catch {
      // ignore
    }
  }

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  if (leagues.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Enter Rosters</h1>
        <p className="text-sm text-neutral-500">
          You need at least one league before entering rosters.{" "}
          <Link href="/leagues" className="text-blue-600 hover:underline">
            Add a league
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Enter Rosters</h1>
          <p className="text-sm text-neutral-500">
            Season {seasonYear}, Week {weekNumber}
          </p>
        </div>
        <select
          value={leagueId ?? ""}
          onChange={(e) => selectLeague(parseInt(e.target.value, 10))}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          {leagues.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.platform})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-1 text-sm">
        <button
          onClick={() => setMode("matchup")}
          className={`rounded px-3 py-1.5 ${
            mode === "matchup"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 dark:border-neutral-700"
          }`}
        >
          Paste Matchup (both teams)
        </button>
        <button
          onClick={() => setMode("separate")}
          className={`rounded px-3 py-1.5 ${
            mode === "separate"
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "border border-neutral-300 dark:border-neutral-700"
          }`}
        >
          Paste Separately
        </button>
      </div>

      {leagueId && mode === "matchup" && (
        <MatchupEntry key={`matchup-${leagueId}`} leagueId={leagueId} seasonYear={seasonYear} weekNumber={weekNumber} />
      )}

      {leagueId && mode === "separate" && (
        <div className="flex flex-col gap-4 md:flex-row">
          <RosterPasteBox
            key={`mine-${leagueId}`}
            title="My Roster"
            side="mine"
            leagueId={leagueId}
            seasonYear={seasonYear}
            weekNumber={weekNumber}
          />
          <RosterPasteBox
            key={`opp-${leagueId}`}
            title="Opponent Roster"
            side="opponent"
            leagueId={leagueId}
            seasonYear={seasonYear}
            weekNumber={weekNumber}
            opponentLabel={opponentLabel}
            onOpponentLabelChange={setOpponentLabel}
          />
        </div>
      )}
    </div>
  );
}
