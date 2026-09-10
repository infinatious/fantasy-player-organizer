# Fantasy Player Organizer

A local web app for tracking your fantasy football rosters across Sleeper, ESPN, and Yahoo!. Paste in your roster (and your weekly opponent's roster) for each league, and it tells you who to watch and when.

## What it does

- **Leagues**: register each league you play in (name + platform).
- **Enter Rosters**: each week, paste your team's roster and your current opponent's roster (as copied from any platform's UI) into a league. The app matches pasted lines against real NFL players and lets you manually resolve anything it couldn't match.
- **Dashboard**: shows every rostered player grouped by kickoff timeslot (Thursday Night, Sunday Early/Late/Night, Monday Night, etc.), with a "Root For" / "Root Against" / "Mixed" badge per player based on whether they're on your team or an opponent's team across your leagues, and which league(s) that applies to.

Game schedule/timeslot data comes live from ESPN's public scoreboard API; player identity data comes from Sleeper's public players list. Both are cached locally in SQLite (`data/app.db`, gitignored) and refreshed automatically.

## Running it

```bash
npm install
npm run dev
```

Open http://localhost:3000, add a league under **Leagues**, then paste rosters under **Enter Rosters**. The **Dashboard** is the weekly view — season/week is set in the top nav and persists across pages.

## Notes on roster parsing

Pasted roster text doesn't need to be clean — the parser normalizes each line and looks for a known player's name inside it, so extra columns (position, team, projected points, bye week, etc.) are fine. Team defenses are matched by mascot name (e.g. "49ers D/ST", "Cowboys DEF"). Anything that doesn't match gets flagged for manual resolution via a search box before saving.
