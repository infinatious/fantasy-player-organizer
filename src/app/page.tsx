"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSeasonWeek } from "@/context/SeasonWeekContext";
import { teamGlowStyle, playerImageUrl, positionBadgeClasses, TEAM_COLORS } from "@/lib/teamColors";

interface DashboardLeagueRef {
  leagueId: number;
  leagueName: string;
  leagueWeight: number;
  side: "mine" | "opponent";
  opponentLabel: string | null;
}

interface DashboardPlayer {
  playerId: string | null;
  name: string;
  team: string | null;
  position: string | null;
  injuryStatus: string | null;
  opponent: string | null;
  kickoffIso: string | null;
  score: number;
  leagues: DashboardLeagueRef[];
}

interface DashboardTeamGroup {
  team: string | null;
  players: DashboardPlayer[];
}

interface DashboardGame {
  label: string | null;
  kickoffIso: string | null;
  teams: DashboardTeamGroup[];
}

interface DashboardTimeslot {
  name: string;
  games: DashboardGame[];
}

// Rooting-score bands, shaded red (strongly against) through yellow (mixed)
// to green (strongly for).
function rootingTier(score: number): { label: string; className: string } {
  if (score >= 66) {
    return { label: "Root For", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  }
  if (score >= 33) {
    return {
      label: "Mostly Root For",
      className: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    };
  }
  if (score >= -20) {
    return { label: "Mixed", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" };
  }
  if (score >= -50) {
    return {
      label: "Root Against",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    };
  }
  return {
    label: "Strongly Root Against",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
}

function splitName(name: string): [string, string | null] {
  const spaceIndex = name.indexOf(" ");
  if (spaceIndex === -1) return [name, null];
  return [name.slice(0, spaceIndex), name.slice(spaceIndex + 1)];
}

function formatKickoff(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DashboardPage() {
  const { seasonYear, weekNumber } = useSeasonWeek();
  const [timeslots, setTimeslots] = useState<DashboardTimeslot[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/dashboard?season=${seasonYear}&week=${weekNumber}`);
    const data = await res.json();
    setTimeslots(data.timeslots ?? []);
    setUnmatchedCount(data.unmatchedCount ?? 0);
    setLoading(false);
  }, [seasonYear, weekNumber]);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  async function refreshSchedule() {
    setRefreshing(true);
    setError(null);
    const res = await fetch(`/api/schedule?season=${seasonYear}&week=${weekNumber}&force=true`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to refresh schedule");
    }
    await load();
    setRefreshing(false);
  }

  const totalPlayers = timeslots.reduce(
    (sum, t) =>
      sum + t.games.reduce((gsum, g) => gsum + g.teams.reduce((tsum, tg) => tsum + tg.players.length, 0), 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            Week {weekNumber} Dashboard — {seasonYear}
          </h1>
          <p className="text-sm text-neutral-500">
            Who to watch, grouped by kickoff time, across all your leagues.
          </p>
        </div>
        <button
          onClick={refreshSchedule}
          disabled={refreshing}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          {refreshing ? "Refreshing…" : "Refresh Schedule"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {unmatchedCount > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {unmatchedCount} pasted player{unmatchedCount === 1 ? "" : "s"} couldn&apos;t be matched.{" "}
          <Link href="/entry" className="underline">
            Review in Enter Rosters
          </Link>
          .
        </p>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : totalPlayers === 0 ? (
        <p className="text-sm text-neutral-500">
          No rosters saved for this week yet.{" "}
          <Link href="/entry" className="text-blue-600 hover:underline">
            Paste your rosters
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <div className="space-y-6">
          {timeslots.map((slot) => (
            <section key={slot.name}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {slot.name}
              </h2>
              <div className="space-y-4">
                {slot.games.map((game, gi) => (
                  <div key={gi}>
                    {game.label && (
                      <h3 className="mb-1.5 text-xs font-semibold text-neutral-400">
                        {game.label}
                        {game.kickoffIso ? ` · ${formatKickoff(game.kickoffIso)}` : ""}
                      </h3>
                    )}
                    <div className="space-y-3">
                      {game.teams.map((teamGroup, ti) => (
                        <div key={ti}>
                          <h4
                            className="mb-1 text-xs font-bold uppercase tracking-wide"
                            style={{ color: teamGroup.team ? TEAM_COLORS[teamGroup.team] : undefined }}
                          >
                            {teamGroup.team ?? "No Team"}
                          </h4>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {teamGroup.players.map((p) => (
                              <div
                                key={p.playerId}
                                style={teamGlowStyle(p.team)}
                                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    {p.playerId && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={playerImageUrl(p.playerId, p.position)}
                                        alt=""
                                        className="h-14 w-14 shrink-0 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
                                        onError={(e) => {
                                          e.currentTarget.style.visibility = "hidden";
                                        }}
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <div>
                                        {(() => {
                                          const [first, last] = splitName(p.name);
                                          return (
                                            <>
                                              <p className="player-name text-lg uppercase leading-none">
                                                {first}
                                              </p>
                                              {last && (
                                                <p className="player-name text-lg uppercase leading-none">
                                                  {last}
                                                </p>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                      <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
                                        {p.position && (
                                          <span
                                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${positionBadgeClasses(p.position)}`}
                                          >
                                            {p.position}
                                          </span>
                                        )}
                                        <span>
                                          {p.team}
                                          {!game.label && p.opponent ? ` vs ${p.opponent}` : ""}
                                          {p.injuryStatus ? ` · ${p.injuryStatus}` : ""}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${rootingTier(p.score).className}`}
                                  >
                                    {rootingTier(p.score).label}
                                  </span>
                                </div>
                                <ul className="mt-2 space-y-0.5">
                                  {p.leagues.map((l, i) => (
                                    <li key={i} className="text-xs text-neutral-500">
                                      <span className={l.side === "mine" ? "text-green-600" : "text-red-600"}>
                                        {l.side === "mine" ? "Your team" : "Opponent"}
                                      </span>{" "}
                                      in {l.leagueName}
                                      {l.side === "opponent" && l.opponentLabel ? ` (${l.opponentLabel})` : ""}
                                      <span className="text-neutral-400"> · weight {l.leagueWeight}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
