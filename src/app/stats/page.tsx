"use client";

import { useEffect, useMemo, useState } from "react";
import { useSeasonWeek } from "@/context/SeasonWeekContext";
import { SeasonWeekPicker } from "@/components/SeasonWeekPicker";
import { PlatformBadge } from "@/components/PlatformBadge";
import { normalizeDepthChartData, type DepthChartPlayer } from "@/lib/depthChart";
import { playerImageUrl, positionBadgeClasses } from "@/lib/teamColors";
import type { Platform } from "@/lib/platforms";

interface League {
  id: number;
  name: string;
  team_name: string | null;
  platform: Platform;
  weight: number;
}

interface ResultRow {
  league_id: number;
  season_year: number;
  week_number: number;
  result: "W" | "L" | "T";
}

interface RosterCountRow {
  key: string;
  player: DepthChartPlayer;
  leagueIds: number[];
}

const SERIOUS_THRESHOLD = 5;
const RESULT_OPTIONS = ["W", "L", "T"] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function record(rows: ResultRow[]): { w: number; l: number; t: number } {
  return {
    w: rows.filter((r) => r.result === "W").length,
    l: rows.filter((r) => r.result === "L").length,
    t: rows.filter((r) => r.result === "T").length,
  };
}

function formatRecord(r: { w: number; l: number; t: number }): string {
  return r.t > 0 ? `${r.w}-${r.l}-${r.t}` : `${r.w}-${r.l}`;
}

function RosterAvatar({ player }: { player: DepthChartPlayer }) {
  const [imgError, setImgError] = useState(false);
  return player.playerId && !imgError ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={playerImageUrl(player.playerId, player.position)}
      alt=""
      className="h-10 w-10 shrink-0 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
      onError={() => setImgError(true)}
    />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
      {initials(player.name)}
    </div>
  );
}

export default function StatsPage() {
  const { seasonYear, weekNumber } = useSeasonWeek();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [rosterCounts, setRosterCounts] = useState<RosterCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlySerious, setOnlySerious] = useState(false);
  const [resultsModalOpen, setResultsModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [leaguesRes, resultsRes] = await Promise.all([
        fetch("/api/leagues"),
        fetch(`/api/results?season=${seasonYear}`),
      ]);
      const leaguesData = await leaguesRes.json();
      const resultsData = await resultsRes.json();
      const leagueList: League[] = leaguesData.leagues ?? [];
      setLeagues(leagueList);
      setResults(resultsData.results ?? []);

      const depthCharts = await Promise.all(
        leagueList.map(async (l) => {
          const r = await fetch(`/api/depth-chart/${l.id}`);
          const d = await r.json();
          return { league: l, data: normalizeDepthChartData(d.data) };
        })
      );
      const tally = new Map<string, { player: DepthChartPlayer; leagueIds: Set<number> }>();
      depthCharts.forEach(({ league, data }) => {
        data.players.forEach((p) => {
          if (p.zone === "cut") return;
          const key = p.playerId ?? `name:${p.name.toLowerCase()}`;
          const entry = tally.get(key);
          if (entry) entry.leagueIds.add(league.id);
          else tally.set(key, { player: p, leagueIds: new Set([league.id]) });
        });
      });
      const rows = [...tally.entries()]
        .map(([key, v]) => ({ key, player: v.player, leagueIds: [...v.leagueIds] }))
        .filter((r) => r.leagueIds.length > 1)
        .sort((a, b) => b.leagueIds.length - a.leagueIds.length)
        .slice(0, 20);
      setRosterCounts(rows);
      setLoading(false);
    })();
  }, [seasonYear]);

  async function setResult(leagueId: number, week: number, result: "W" | "L" | "T" | null) {
    setResults((prev) => {
      const next = prev.filter((r) => !(r.league_id === leagueId && r.week_number === week));
      if (result) next.push({ league_id: leagueId, season_year: seasonYear, week_number: week, result });
      return next;
    });
    await fetch("/api/results", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leagueId, seasonYear, weekNumber: week, result }),
    });
  }

  const filteredLeagues = useMemo(
    () => (onlySerious ? leagues.filter((l) => l.weight >= SERIOUS_THRESHOLD) : leagues),
    [leagues, onlySerious]
  );

  const overall = useMemo(() => {
    const ids = new Set(filteredLeagues.map((l) => l.id));
    return record(results.filter((r) => ids.has(r.league_id)));
  }, [results, filteredLeagues]);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Stats</h1>
        <p className="text-sm text-neutral-500">Season {seasonYear}</p>
      </div>

      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Overall Record</h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-500">
              <input type="checkbox" checked={onlySerious} onChange={(e) => setOnlySerious(e.target.checked)} />
              Only serious leagues (importance ≥ {SERIOUS_THRESHOLD})
            </label>
            <button
              onClick={() => setResultsModalOpen(true)}
              className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              Enter Weekly Results
            </button>
          </div>
        </div>
        <p className="text-3xl font-bold">{formatRecord(overall)}</p>
        <p className="text-xs text-neutral-500">
          Across {filteredLeagues.length} league{filteredLeagues.length === 1 ? "" : "s"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Players Rostered in Most Leagues</h2>
        {rosterCounts.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No player is currently on more than one league&apos;s depth chart.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {rosterCounts.map((r) => (
              <li key={r.key} className="flex items-center gap-3 px-4 py-2.5">
                <RosterAvatar player={r.player} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight">{r.player.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${positionBadgeClasses(r.player.position)}`}
                    >
                      {r.player.position}
                    </span>
                    {r.player.team && <span className="text-xs text-neutral-500">{r.player.team}</span>}
                  </p>
                </div>
                <span
                  title={`${r.leagueIds.length} of ${leagues.length} leagues`}
                  className="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  {Math.round((r.leagueIds.length / leagues.length) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resultsModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setResultsModalOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Weekly Results</h3>
              <SeasonWeekPicker />
            </div>
            {leagues.length === 0 ? (
              <p className="text-sm text-neutral-500">No leagues yet.</p>
            ) : (
              <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
                {leagues.map((l) => {
                  const seasonRecord = record(results.filter((r) => r.league_id === l.id));
                  const current =
                    results.find((r) => r.league_id === l.id && r.week_number === weekNumber)?.result ?? null;
                  return (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <PlatformBadge platform={l.platform} />
                        <div>
                          <p className="font-medium leading-tight">{l.team_name || l.name}</p>
                          <p className="text-xs text-neutral-500">{formatRecord(seasonRecord)} this season</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {RESULT_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setResult(l.id, weekNumber, current === opt ? null : opt)}
                            className={`h-8 w-8 rounded text-sm font-semibold ${
                              current === opt
                                ? opt === "W"
                                  ? "bg-green-600 text-white"
                                  : opt === "L"
                                    ? "bg-red-600 text-white"
                                    : "bg-neutral-500 text-white"
                                : "border border-neutral-300 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setResultsModalOpen(false)}
                className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
