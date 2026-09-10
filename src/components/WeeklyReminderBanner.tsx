"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCurrentSeasonAndWeek } from "@/lib/weekUtils";

interface LeagueEntryStatus {
  leagueId: number;
  leagueName: string;
  hasMine: boolean;
  hasOpponent: boolean;
}

export function WeeklyReminderBanner() {
  const pathname = usePathname();
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [incomplete, setIncomplete] = useState<LeagueEntryStatus[]>([]);

  useEffect(() => {
    (async () => {
      const { seasonYear, weekNumber } = getCurrentSeasonAndWeek();
      setWeekNumber(weekNumber);
      const res = await fetch(`/api/weekly-status?season=${seasonYear}&week=${weekNumber}`);
      const data = await res.json();
      const leagues: LeagueEntryStatus[] = data.leagues ?? [];
      setIncomplete(leagues.filter((l) => !l.hasMine || !l.hasOpponent));
    })();
  }, []);

  // Don't nag you on the page you'd use to fix it.
  if (pathname === "/entry" || weekNumber === null || incomplete.length === 0) return null;

  const names = incomplete.map((l) => l.leagueName);
  const preview = names.length > 3 ? `${names.slice(0, 3).join(", ")} +${names.length - 3} more` : names.join(", ");

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 sm:px-6 lg:px-8">
      Week {weekNumber} rosters aren&apos;t fully entered yet — {incomplete.length} league
      {incomplete.length === 1 ? "" : "s"} need attention ({preview}).{" "}
      <Link href="/entry" className="font-medium underline">
        Paste them now
      </Link>
      .
    </div>
  );
}
