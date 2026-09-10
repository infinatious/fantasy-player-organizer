"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getCurrentSeasonAndWeek } from "@/lib/weekUtils";

interface SeasonWeekState {
  seasonYear: number;
  weekNumber: number;
  setSeasonYear: (year: number) => void;
  setWeekNumber: (week: number) => void;
}

const SeasonWeekContext = createContext<SeasonWeekState | null>(null);

const STORAGE_KEY = "fpo-season-week";

export function SeasonWeekProvider({ children }: { children: ReactNode }) {
  const defaults = getCurrentSeasonAndWeek();
  const [seasonYear, setSeasonYear] = useState(defaults.seasonYear);
  const [weekNumber, setWeekNumber] = useState(defaults.weekNumber);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.seasonYear) setSeasonYear(parsed.seasonYear);
          if (parsed.weekNumber) setWeekNumber(parsed.weekNumber);
        }
      } catch {
        // ignore malformed storage
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ seasonYear, weekNumber }));
  }, [seasonYear, weekNumber, loaded]);

  return (
    <SeasonWeekContext.Provider value={{ seasonYear, weekNumber, setSeasonYear, setWeekNumber }}>
      {children}
    </SeasonWeekContext.Provider>
  );
}

export function useSeasonWeek(): SeasonWeekState {
  const ctx = useContext(SeasonWeekContext);
  if (!ctx) throw new Error("useSeasonWeek must be used within SeasonWeekProvider");
  return ctx;
}
