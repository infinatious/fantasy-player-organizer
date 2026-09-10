"use client";

import { useSeasonWeek } from "@/context/SeasonWeekContext";

export function SeasonWeekPicker() {
  const { seasonYear, weekNumber, setSeasonYear, setWeekNumber } = useSeasonWeek();

  return (
    <div className="flex items-center gap-2 text-sm">
      <label className="flex items-center gap-1 text-neutral-500">
        Season
        <input
          type="number"
          value={seasonYear}
          onChange={(e) => setSeasonYear(parseInt(e.target.value, 10) || seasonYear)}
          className="w-20 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="flex items-center gap-1 text-neutral-500">
        Week
        <input
          type="number"
          min={1}
          max={18}
          value={weekNumber}
          onChange={(e) => setWeekNumber(parseInt(e.target.value, 10) || weekNumber)}
          className="w-16 rounded border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
    </div>
  );
}
