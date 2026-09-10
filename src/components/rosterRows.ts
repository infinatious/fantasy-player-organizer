export interface PlayerRow {
  player_id: string;
  full_name: string;
  team: string | null;
  position: string | null;
}

export interface ParsedLine {
  rawLine: string;
  match: PlayerRow | null;
  candidates: PlayerRow[];
}

export interface Row {
  rawLine: string;
  playerId: string | null;
  displayName: string;
  team: string | null;
  position: string | null;
  candidates: PlayerRow[];
  searchOpen: boolean;
  searchQuery: string;
  searchResults: PlayerRow[];
}

export function rowFromParsedLine(line: ParsedLine): Row {
  return {
    rawLine: line.rawLine,
    playerId: line.match?.player_id ?? null,
    displayName: line.match?.full_name ?? line.rawLine,
    team: line.match?.team ?? null,
    position: line.match?.position ?? null,
    candidates: line.candidates,
    searchOpen: false,
    searchQuery: "",
    searchResults: [],
  };
}

export interface SavedEntry {
  raw_text: string;
  player_id: string | null;
  display_name: string;
  team: string | null;
  position: string | null;
}

export function rowFromSavedEntry(e: SavedEntry): Row {
  return {
    rawLine: e.raw_text,
    playerId: e.player_id,
    displayName: e.display_name,
    team: e.team,
    position: e.position,
    candidates: [],
    searchOpen: false,
    searchQuery: "",
    searchResults: [],
  };
}
