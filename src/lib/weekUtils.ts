// Pure date/time helpers with no server-only dependencies, safe to import
// from client components.

export function classifyTimeslot(kickoffIso: string): string {
  const date = new Date(kickoffIso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutesSinceMidnight = hour * 60 + minute;

  switch (weekday) {
    case "Wed":
      return "Wednesday Night";
    case "Thu":
      return "Thursday Night";
    case "Fri":
      return "Friday";
    case "Sat":
      return "Saturday";
    case "Mon":
      return "Monday Night";
    case "Sun":
      if (minutesSinceMidnight < 11 * 60 + 30) return "Sunday Morning (Intl)";
      if (minutesSinceMidnight < 15 * 60 + 35) return "Sunday Early";
      if (minutesSinceMidnight < 19 * 60) return "Sunday Late";
      return "Sunday Night";
    default:
      return "Other";
  }
}

export function getCurrentSeasonAndWeek(): { seasonYear: number; weekNumber: number } {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  let seasonYear = now.getFullYear();
  if (month < 3) {
    // Jan/Feb still belong to the prior season (playoffs).
    seasonYear -= 1;
  }
  // NFL regular season week 1 typically kicks off the Thursday after Labor Day
  // (first Monday of September). Approximate week 1 start as Sept 5 of seasonYear.
  const approxWeek1Start = new Date(Date.UTC(seasonYear, 8, 5)); // Sept 5
  const diffMs = now.getTime() - approxWeek1Start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  const weekNumber = Math.min(18, Math.max(1, diffWeeks + 1));
  return { seasonYear, weekNumber };
}
