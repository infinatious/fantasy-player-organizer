import { normalizeName } from "./normalize";
import type { PlayerRow } from "./players";
import type { DepthChartSettings } from "./depthChart";

export interface ParsedRosterLine {
  rawLine: string;
  match: PlayerRow | null;
  candidates: PlayerRow[];
}

// Exact table-chrome strings seen across platform exports (column headers,
// section labels, status text) that should never be treated as an
// unresolved player line.
const NOISE_LINES = new Set([
  "player, team pos",
  "totals",
  "total",
  "comparison",
  "stats",
  "matchup",
  "starters",
  "bench",
  "bye",
  "empty",
  "fan pts",
  "yet to play",
  "video forecast",
  "player note",
  "new player note",
  "no new player notes",
  "box score",
  "injured reserve",
  "taxi",
  "taxi squad",
  "click on position buttons to update your lineup",
  "own %",
  "start %",
]);

// "QB - DEN", "RB - IND": a position+team hint line, not a name.
const POS_TEAM_HINT_RE = /^[A-Za-z]{1,4}\s*-\s*[A-Za-z]{2,4}$/;

// "Sun 10:00 AM", "Thu 5:35 PM", "Sun 5:20 pm vs Dal", "Mon 5:15 PM@ KC",
// "Sun 10:00 AMvs BAL" (Sleeper runs the opponent straight into the time
// with no space): a game-time line, not a name.
const GAME_TIME_RE = /^(sun|mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat)\s*\d{1,2}:\d{2}\s*(am|pm)/i;

// "Paul's Pack Box Score": ESPN's per-team page title, not a name.
const BOX_SCORE_RE = /\bbox score$/i;

// "7:29 1st 0-0 vs NE": Sleeper's live game-clock/score line.
const LIVE_CLOCK_RE = /^\d{1,2}:\d{2}\s+\d(st|nd|rd|th)\b/i;

// "1/1 REC, 13 YD": Sleeper's live stat line.
const STAT_LINE_RE = /^\d+\/\d+\s/;

// "(Hot Sister)", "(Big Rhonda)": a custom league nickname aside, not a name.
const PARENTHETICAL_RE = /^\(.*\)$/;

// A pasted stat table breaks into far more lines than there are players: team
// abbreviation + position codes ("CINQB"), opponent codes ("@DET", "TB"),
// bare position labels ("FLEX", "D/ST"), and raw numbers ("18.2", "--") all
// end up as their own line. None of those look like a person's name, so
// rather than surfacing every one as "needs review", we only keep an
// unmatched line if it plausibly could be one: multiple words, mostly
// letters, not a known piece of table chrome.
function looksLikePlayerName(line: string): boolean {
  const trimmed = line.trim();
  if (NOISE_LINES.has(trimmed.toLowerCase())) return false;
  // A wide column-header row ("STARTERS\tNFL Week 2\t2026 season", "Pos\tOffense\t...")
  // collapses onto one tab-joined line, unlike real rows in these same pastes
  // which put one cell per line — so 2+ embedded tabs means table chrome.
  if ((trimmed.match(/\t/g) || []).length >= 2) return false;
  if (POS_TEAM_HINT_RE.test(trimmed)) return false;
  if (GAME_TIME_RE.test(trimmed)) return false;
  if (BOX_SCORE_RE.test(trimmed)) return false;
  if (LIVE_CLOCK_RE.test(trimmed)) return false;
  if (STAT_LINE_RE.test(trimmed)) return false;
  if (PARENTHETICAL_RE.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w));
  if (words.length < 2) return false;

  const letterCount = (trimmed.match(/[a-z]/gi) || []).length;
  return letterCount >= 4;
}

// Sleeper's matchup view abbreviates names to "B. Nix" / "T. McBride" with no
// full name anywhere in the paste, so the substring matcher above can never
// find them. Resolve these by last name + first initial, using a following
// "POS - TEAM" line (Sleeper's own format) to disambiguate when more than
// one player shares the name.
const ABBREV_NAME_RE = /^([A-Za-z])\.?\s+([A-Za-z][A-Za-z'.-]*)$/;

// Narrows a same-name candidate list using a "POS - TEAM" hint. Team is the
// more specific signal (rarely two same-named players on one roster); only
// fall back to position if that doesn't narrow it.
function narrowByPositionAndTeam(candidates: PlayerRow[], pos: string, team: string): PlayerRow[] {
  const byTeam = candidates.filter((p) => p.team && p.team.toLowerCase() === team.toLowerCase());
  if (byTeam.length > 0) return byTeam;
  const byPos = candidates.filter((p) => p.position && p.position.toLowerCase() === pos.toLowerCase());
  return byPos.length > 0 ? byPos : candidates;
}

function tryAbbreviatedMatch(
  line: string,
  nextLine: string | undefined,
  allPlayers: PlayerRow[]
): { best: PlayerRow | null; candidates: PlayerRow[] } | null {
  const m = line.trim().match(ABBREV_NAME_RE);
  if (!m) return null;
  const initial = m[1].toLowerCase();
  const lastName = normalizeName(m[2]);
  if (!lastName) return null;

  let candidates = allPlayers.filter(
    (p) =>
      !!p.last_name &&
      !!p.first_name &&
      normalizeName(p.last_name) === lastName &&
      p.first_name.trim().charAt(0).toLowerCase() === initial
  );

  if (candidates.length === 0) return null;

  if (candidates.length > 1 && nextLine) {
    const hint = nextLine.trim().match(/^([A-Za-z]{1,4})\s*-\s*([A-Za-z]{2,4})$/);
    if (hint) candidates = narrowByPositionAndTeam(candidates, hint[1], hint[2]);
  }

  return { best: candidates.length === 1 ? candidates[0] : null, candidates: candidates.slice(0, 5) };
}

// Fantasy platforms' own roster/lineup pages (as opposed to matchup views)
// often copy-paste with no line break between the player's abbreviated name
// and its position/team/bye cell, e.g. Sleeper's "D MayeQB - NE (11)" or
// "J Croskey-MerrittRB - WAS (7)". Recognize the position code explicitly
// (rather than a generic capital-letter run) so it can't misfire on a last
// name that happens to contain capitals of its own (McCaffrey, LaPorta).
const POSITION_CODE_ALTERNATION = "QB|RB|WR|TE|DEF|DST|D/ST|DL|DE|DT|NT|ILB|OLB|LB|DB|CB|FS|SS|S|K/P|K|P";
const INLINE_ABBREV_RE = new RegExp(
  `^([A-Za-z])\\.?\\s+([A-Za-z][A-Za-z'-]*?)(${POSITION_CODE_ALTERNATION})\\s*-\\s*([A-Za-z]{2,4})(?:\\s*\\(\\d{1,2}\\))?$`
);

function tryInlineAbbreviatedMatch(
  line: string,
  allPlayers: PlayerRow[]
): { best: PlayerRow | null; candidates: PlayerRow[] } | null {
  const m = line.trim().match(INLINE_ABBREV_RE);
  if (!m) return null;
  const [, initialRaw, lastNameRaw, pos, team] = m;
  const initial = initialRaw.toLowerCase();
  const lastName = normalizeName(lastNameRaw);
  if (!lastName) return null;

  let candidates = allPlayers.filter(
    (p) =>
      !!p.last_name &&
      !!p.first_name &&
      normalizeName(p.last_name) === lastName &&
      p.first_name.trim().charAt(0).toLowerCase() === initial
  );
  if (candidates.length === 0) return null;

  if (candidates.length > 1) candidates = narrowByPositionAndTeam(candidates, pos, team);

  return { best: candidates.length === 1 ? candidates[0] : null, candidates: candidates.slice(0, 5) };
}

// Copy-pasted tables often duplicate the player's name across adjacent lines
// (hidden tooltip spans, mobile/desktop variants). Collapse consecutive
// mentions of the same player into one entry.
function dedupeConsecutiveMatches(results: ParsedRosterLine[]): ParsedRosterLine[] {
  const deduped: ParsedRosterLine[] = [];
  for (const r of results) {
    const prev = deduped[deduped.length - 1];
    if (r.match && prev?.match && prev.match.player_id === r.match.player_id) continue;
    deduped.push(r);
  }
  return deduped;
}

// Pasted fantasy rosters are one player per line, usually with extra columns
// (position, team, opponent, kickoff time, projected points) mixed in. Rather
// than trying to parse each platform's exact table layout, we normalize the
// whole line and look for any known player's normalized full name inside it,
// scoring matches by name length plus bonus points when the line also
// contains that player's position or team abbreviation.
export function parseRosterText(text: string, allPlayers: PlayerRow[]): ParsedRosterLine[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results: ParsedRosterLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (POS_TEAM_HINT_RE.test(line)) continue;

    const normLine = normalizeName(line);
    if (!normLine || normLine.length < 3) continue;

    let best: PlayerRow | null = null;
    let bestScore = 0;
    let candidates: PlayerRow[] = [];

    for (const p of allPlayers) {
      if (!p.search_name || p.search_name.length < 3) continue;
      if (!normLine.includes(p.search_name)) continue;

      let score = p.search_name.length;
      if (p.position && normLine.includes(p.position.toLowerCase())) score += 5;
      if (p.team) {
        const teamPattern = new RegExp(`\\b${p.team.toLowerCase()}\\b`);
        if (teamPattern.test(normLine)) score += 5;
      }

      candidates.push(p);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (!best) {
      const abbrev = tryAbbreviatedMatch(line, lines[i + 1], allPlayers) ?? tryInlineAbbreviatedMatch(line, allPlayers);
      if (abbrev) {
        best = abbrev.best;
        candidates = abbrev.candidates;
      }
    }

    // Lines that didn't match a known player (directly or via abbreviation)
    // are almost always table chrome, not a real missed player — drop those
    // instead of asking the user to review dozens of them.
    if (!best && candidates.length === 0 && !looksLikePlayerName(line)) continue;

    if (best) {
      candidates.sort((a, b) =>
        a.player_id === best!.player_id ? -1 : b.player_id === best!.player_id ? 1 : 0
      );
    }

    results.push({
      rawLine: line,
      match: best,
      candidates: candidates.slice(0, 5),
    });
  }

  return dedupeConsecutiveMatches(results);
}

export interface MatchupBlock {
  label: string;
  text: string;
}

interface TeamHeader {
  index: number;
  label: string;
}

// ESPN's matchup view has changed shape at least once: the "Matchup" tab
// puts a single-line header per team ("Paul's Pack\tNFL Week 1\tSTATS"),
// while the "Box Score" tab splits it across two lines — a "<Team> Box
// Score" line, then a generic "STARTERS\tNFL Week 1\tTOTAL" table-start
// marker further down. We recognize both.
function findTeamHeaders(lines: string[]): TeamHeader[] {
  const headers: TeamHeader[] = [];

  for (let i = 0; i < lines.length; i++) {
    const collapsed = lines[i].replace(/\t+/g, " ").trim();

    const inline = collapsed.match(/^(.*?)\s*NFL Week\s+\d+\s*STATS\s*$/i);
    if (inline) {
      headers.push({ index: i, label: inline[1].trim() || `Team ${headers.length + 1}` });
      continue;
    }

    if (/^STARTERS\s*NFL Week\s+\d+\s*TOTAL\s*$/i.test(collapsed)) {
      let label = `Team ${headers.length + 1}`;
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j].trim();
        if (!prev) continue;
        const boxMatch = prev.match(/^(.*?)\s+Box Score\s*$/i);
        if (boxMatch) label = boxMatch[1].trim();
        break;
      }
      headers.push({ index: i, label });
    }
  }

  return headers;
}

// Splits a combined matchup paste into each side's block of text by locating
// the two team headers. Returns a single block (the whole text, unsplit) if
// two headers can't be found.
export function splitMatchupIntoTeamBlocks(text: string): MatchupBlock[] {
  const lines = text.split(/\r?\n/);
  const headers = findTeamHeaders(lines);

  if (headers.length < 2) {
    return [{ label: "Team", text }];
  }

  const [first, second] = headers;
  return [
    { label: first.label, text: lines.slice(first.index + 1, second.index).join("\n") },
    { label: second.label, text: lines.slice(second.index + 1).join("\n") },
  ];
}

export interface MatchupRow extends ParsedRosterLine {
  side: 0 | 1;
}

export interface MatchupResult {
  labelA: string;
  labelB: string;
  rows: MatchupRow[];
  method: "header-split" | "alternating";
}

// Not every platform separates the two teams into distinguishable blocks —
// Yahoo and Sleeper's matchup views interleave "your player" and "their
// player" within the same row, position by position. When we can't find
// explicit team headers (ESPN-style), fall back to assuming the parsed
// players alternate sides in document order; the UI lets the user move any
// misassigned row to the other side.
export function parseMatchup(text: string, allPlayers: PlayerRow[]): MatchupResult {
  const blocks = splitMatchupIntoTeamBlocks(text);

  if (blocks.length === 2) {
    const rowsA = parseRosterText(blocks[0].text, allPlayers).map((r) => ({ ...r, side: 0 as const }));
    const rowsB = parseRosterText(blocks[1].text, allPlayers).map((r) => ({ ...r, side: 1 as const }));
    return { labelA: blocks[0].label, labelB: blocks[1].label, rows: [...rowsA, ...rowsB], method: "header-split" };
  }

  const flat = parseRosterText(text, allPlayers);
  const rows: MatchupRow[] = flat.map((r, i) => ({ ...r, side: (i % 2 === 0 ? 0 : 1) as 0 | 1 }));
  return { labelA: "Team A", labelB: "Team B", rows, method: "alternating" };
}

// Sleeper, ESPN, and Yahoo all lay out a roster as one row per slot with the
// slot's label as its own cell — which, once pasted as plain text, becomes a
// standalone line immediately before that row's player. Sleeper additionally
// explodes a FLEX/superflex slot's letters ("W","R","T" or "W","R","T","Q")
// across their own lines. Tallying exact matches against these known tokens
// (rather than trying to read the header row, which varies by league scoring
// format) lets us infer the league's starter/bench shape straight from a
// pasted roster.
const FLEX_LETTERS = new Set(["Q", "W", "R", "T"]);

const SLOT_TOKEN_TO_SETTING: Record<string, keyof DepthChartSettings> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DL: "DL",
  LB: "LB",
  DB: "DB",
  FLEX: "FLEX",
  "W/R/T": "FLEX",
  "Q/W/R/T": "FLEX",
  BN: "BENCH",
  Bench: "BENCH",
  IR: "IR",
  TX: "TAXI",
};

// A genuine slot-label line is always immediately followed by that row's
// player identifier. A bare number/percentage right after rules out a slot
// label — this is what filters out Sleeper's "IR" *injury status* line
// (buried mid-row, followed by more stat cells like "61%") from being
// mistaken for another "IR" *roster slot* row.
const NUMERIC_CELL_RE = /^-?\$?[\d.]+%?$/;

function looksLikeRowStart(line: string | undefined): boolean {
  return line !== undefined && !NUMERIC_CELL_RE.test(line);
}

// Only returns settings we found direct evidence for — a paste that doesn't
// happen to include, say, the IR section shouldn't be read as "this league
// has zero IR spots" and clobber whatever the user already configured.
export function inferSlotCounts(text: string): Partial<DepthChartSettings> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const counts: Partial<Record<keyof DepthChartSettings, number>> = {};
  const bump = (key: keyof DepthChartSettings) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.length === 1 && FLEX_LETTERS.has(line)) {
      let j = i;
      while (j < lines.length && lines[j].length === 1 && FLEX_LETTERS.has(lines[j])) j++;
      if (looksLikeRowStart(lines[j])) bump("FLEX");
      i = j;
      continue;
    }

    const mapped = SLOT_TOKEN_TO_SETTING[line];
    if (mapped && looksLikeRowStart(lines[i + 1])) bump(mapped);
    i++;
  }

  return counts;
}
