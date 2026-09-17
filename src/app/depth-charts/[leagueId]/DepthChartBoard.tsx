"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type DepthChartData,
  type DepthChartPlayer,
  type DepthChartSettings,
  DEFAULT_DEPTH_CHART_SETTINGS,
  FLEX_TYPES,
  OFFENSE_FLEX_POSITIONS,
  POSITIONS,
  RESERVE_KINDS,
  buildAcceptMap,
  emptyDepthChartData,
  mapToDepthChartPosition,
  normalizeDepthChartData,
  offenseFlexUsed,
  posFullName,
  uid,
} from "@/lib/depthChart";
import { playerImageUrl, positionBadgeClasses, teamGlowStyle, teamLogoUrl } from "@/lib/teamColors";
import { withBasePath } from "@/lib/basePath";
import type { PlayerRow } from "@/lib/players";
import { PasteRosterModal, type ImportItem } from "./PasteRosterModal";
import { SleeperSyncModal } from "./SleeperSyncModal";

const ACCEPT = buildAcceptMap();
const OFFENSE_FLEX_SET = new Set<string>(OFFENSE_FLEX_POSITIONS);

function playersInZone(players: DepthChartPlayer[], zone: string): DepthChartPlayer[] {
  return players.filter((p) => p.zone === zone).sort((a, b) => a.order - b.order);
}

function totalBenchCount(players: DepthChartPlayer[]): number {
  return players.filter((p) => p.zone.startsWith("backup-") || p.zone.startsWith("stash-")).length;
}

function computeInsertIndex(container: HTMLElement, clientY: number, excludeId: string): number {
  const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-card-id]")).filter(
    (el) => el.dataset.cardId !== excludeId
  );
  for (let i = 0; i < cards.length; i++) {
    const box = cards[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) return i;
  }
  return cards.length;
}

// Real Sleeper player IDs so the sample roster shows actual headshots —
// otherwise every card would fall back to initials, which defeats the
// purpose of a visual demo.
interface PlayerFormState {
  id: string | null;
  name: string;
  position: string;
  team: string;
  playerId: string | null;
  injuryStatus: string | null;
  destination: string;
}

function CountBadge({ filled, capacity }: { filled: number; capacity: number }) {
  const over = filled > capacity;
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
        over
          ? "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300"
          : "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
      }`}
    >
      {filled}/{capacity}
    </span>
  );
}

function PlayerCard({
  player,
  dragging,
  isFlexExtra,
  onDragStart,
  onDragEnd,
  onEdit,
  onRemove,
}: {
  player: DepthChartPlayer;
  dragging: boolean;
  isFlexExtra?: boolean;
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const initials = player.name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      draggable
      data-card-id={player.id}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={teamGlowStyle(player.team)}
      className={`group relative flex cursor-grab select-none items-center gap-2 overflow-hidden rounded-lg border border-neutral-200 bg-white p-1.5 pr-1 transition-opacity active:cursor-grabbing dark:border-neutral-800 dark:bg-neutral-900 ${
        dragging ? "opacity-30" : ""
      }`}
    >
      {isFlexExtra && (
        <span
          title="Filling a FLEX slot"
          className="absolute top-0.5 right-0.5 z-10 rounded bg-neutral-700 px-1 py-0.5 text-[8px] font-bold text-white dark:bg-neutral-200 dark:text-neutral-900"
        >
          FLEX
        </span>
      )}
      {player.team && !logoError && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={teamLogoUrl(player.team)}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-1 -bottom-3 h-14 w-14 object-contain opacity-[0.07] grayscale dark:opacity-[0.12]"
          onError={() => setLogoError(true)}
        />
      )}
      <div className="relative flex min-w-0 flex-1 items-center gap-2">
        {player.playerId && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={playerImageUrl(player.playerId, player.position)}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full bg-neutral-200 object-cover dark:bg-neutral-800"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="player-name truncate text-sm uppercase leading-tight">{player.name}</p>
          <p className="mt-0.5 flex items-center gap-1">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${positionBadgeClasses(player.position)}`}>
              {player.position}
            </span>
            {player.team && <span className="truncate text-[11px] text-neutral-500">{player.team}</span>}
            {player.injuryStatus && (
              <span
                className={`text-[11px] font-semibold ${
                  ["OUT", "IR", "PUP", "NA"].includes(player.injuryStatus.toUpperCase())
                    ? "text-red-500"
                    : "text-amber-500"
                }`}
              >
                {player.injuryStatus}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Edit player"
            className="rounded p-0.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Remove player"
            className="rounded p-0.5 text-xs text-neutral-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

function DropZone({
  zoneKey,
  players,
  compact,
  emptyText,
  borderClassName,
  flexExtraIds,
  hoverZone,
  setHoverZone,
  draggingId,
  onDragStartCard,
  onDragEndCard,
  onDropZone,
  onEdit,
  onRemove,
}: {
  zoneKey: string;
  players: DepthChartPlayer[];
  compact?: boolean;
  emptyText?: string;
  borderClassName?: string;
  flexExtraIds?: Set<string>;
  hoverZone: string | null;
  setHoverZone: (z: string | null | ((prev: string | null) => string | null)) => void;
  draggingId: string | null;
  onDragStartCard: (e: React.DragEvent<HTMLDivElement>, player: DepthChartPlayer) => void;
  onDragEndCard: () => void;
  onDropZone: (zoneKey: string, container: HTMLElement, clientY: number, playerId: string) => void;
  onEdit: (player: DepthChartPlayer) => void;
  onRemove: (player: DepthChartPlayer) => void;
}) {
  const isHover = hoverZone === zoneKey;
  return (
    <div
      data-zone={zoneKey}
      onDragOver={(e) => {
        e.preventDefault();
        setHoverZone(zoneKey);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setHoverZone((z) => (z === zoneKey ? null : z));
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHoverZone(null);
        const playerId = e.dataTransfer.getData("text/plain");
        if (playerId) onDropZone(zoneKey, e.currentTarget, e.clientY, playerId);
      }}
      className={`flex flex-col gap-1.5 rounded-lg border border-dashed p-2 transition-colors ${
        isHover
          ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
          : (borderClassName ?? "border-neutral-300 dark:border-neutral-700")
      } ${compact ? "min-h-[52px]" : "min-h-[96px]"}`}
    >
      {players.length === 0 && <p className="py-2 text-center text-xs text-neutral-400">{emptyText ?? "Empty"}</p>}
      {players.map((p) => (
        <PlayerCard
          key={p.id}
          player={p}
          dragging={draggingId === p.id}
          isFlexExtra={flexExtraIds?.has(p.id)}
          onDragStart={(e) => onDragStartCard(e, p)}
          onDragEnd={onDragEndCard}
          onEdit={() => onEdit(p)}
          onRemove={() => onRemove(p)}
        />
      ))}
    </div>
  );
}

export function DepthChartBoard({ leagueId }: { leagueId: number }) {
  const [data, setData] = useState<DepthChartData | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [sleeperLeagueId, setSleeperLeagueId] = useState<string | null>(null);
  const [sleeperRosterId, setSleeperRosterId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<DepthChartSettings>(DEFAULT_DEPTH_CHART_SETTINGS);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverZone, setHoverZone] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [sleeperOpen, setSleeperOpen] = useState(false);

  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit">("closed");
  const [form, setForm] = useState<PlayerFormState>({
    id: null,
    name: "",
    position: "QB",
    team: "",
    playerId: null,
    injuryStatus: null,
    destination: "backup",
  });
  const [suggestions, setSuggestions] = useState<PlayerRow[]>([]);
  const lastPickedNameRef = useRef<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [dcRes, leaguesRes] = await Promise.all([
        fetch(withBasePath(`/api/depth-chart/${leagueId}`)),
        fetch(withBasePath("/api/leagues")),
      ]);
      const dc = await dcRes.json();
      const leaguesData = await leaguesRes.json();
      if (cancelled) return;
      const normalized = normalizeDepthChartData(dc.data);
      setData(normalized);
      setDraft(normalized.settings);
      const league = (leaguesData.leagues ?? []).find((l: { id: number }) => l.id === leagueId);
      setLeagueName(league?.name ?? "");
      setSleeperLeagueId(league?.sleeper_league_id ?? null);
      setSleeperRosterId(league?.sleeper_roster_id ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  useEffect(() => {
    if (modalMode === "closed") return;
    const query = form.name.trim();
    if (query.length < 2 || query === lastPickedNameRef.current) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(withBasePath(`/api/players/search?q=${encodeURIComponent(query)}`));
      const json = await res.json();
      setSuggestions(json.players ?? []);
    }, 250);
    return () => clearTimeout(handle);
  }, [form.name, modalMode]);

  function showToast(msg: string) {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2500);
  }

  async function commit(next: DepthChartData) {
    setData(next);
    try {
      await fetch(withBasePath(`/api/depth-chart/${leagueId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch {
      showToast("Failed to save — check your connection");
    }
  }

  function addPlayer(input: {
    name: string;
    position: string;
    team: string | null;
    playerId: string | null;
    injuryStatus: string | null;
    destination: string;
  }) {
    if (!data) return;
    const zoneKey =
      input.destination === "backup" || input.destination === "stash"
        ? `${input.destination}-${input.position}`
        : input.destination;
    const orders = playersInZone(data.players, zoneKey).map((p) => p.order);
    const order = orders.length ? Math.max(...orders) + 1 : 0;
    const player: DepthChartPlayer = {
      id: uid(),
      playerId: input.playerId,
      name: input.name,
      position: input.position,
      team: input.team,
      injuryStatus: input.injuryStatus,
      zone: zoneKey,
      order,
    };
    const next = { ...data, players: [...data.players, player] };
    commit(next);
    if ((input.destination === "backup" || input.destination === "stash") && totalBenchCount(next.players) > next.settings.BENCH) {
      showToast(`Bench is over your set limit (${next.settings.BENCH})`);
    }
  }

  function importPlayers(items: ImportItem[], destination: string, detectedSettings?: Partial<DepthChartSettings>) {
    if (!data) return;
    const existingIds = new Set(data.players.map((p) => p.playerId).filter((id): id is string => !!id));
    const players = [...data.players];
    let added = 0;
    let skipped = 0;

    items.forEach((item) => {
      if (item.playerId && existingIds.has(item.playerId)) {
        skipped++;
        return;
      }
      const zoneKey = destination === "backup" || destination === "stash" ? `${destination}-${item.position}` : destination;
      const orders = players.filter((p) => p.zone === zoneKey).map((p) => p.order);
      const order = orders.length ? Math.max(...orders) + 1 : 0;
      players.push({
        id: uid(),
        playerId: item.playerId,
        name: item.name,
        position: item.position,
        team: item.team,
        injuryStatus: item.injuryStatus,
        zone: zoneKey,
        order,
      });
      if (item.playerId) existingIds.add(item.playerId);
      added++;
    });

    if (added === 0 && !detectedSettings) {
      showToast(skipped > 0 ? `All ${skipped} already on the chart — nothing to add` : "No players to import");
      return;
    }

    const settings = detectedSettings ? { ...data.settings, ...detectedSettings } : data.settings;
    const next = { ...data, players, settings };
    commit(next);
    if (detectedSettings) setDraft(settings);
    setPasteOpen(false);
    const addedMsg = added > 0 ? `${added} player${added === 1 ? "" : "s"} added` : "";
    const settingsMsg = detectedSettings ? "league settings updated to match" : "";
    showToast(
      [addedMsg, settingsMsg].filter(Boolean).join(" · ") +
        (skipped ? ` (${skipped} already on the chart, skipped)` : "")
    );
    if ((destination === "backup" || destination === "stash") && totalBenchCount(next.players) > next.settings.BENCH) {
      showToast(`Bench is over your set limit (${next.settings.BENCH})`);
    }
  }

  function editPlayer(
    id: string,
    input: {
      name: string;
      position: string;
      team: string | null;
      playerId: string | null;
      injuryStatus: string | null;
      destination: string;
    }
  ) {
    if (!data) return;
    const players = data.players.map((p) => ({ ...p }));
    const player = players.find((p) => p.id === id);
    if (!player) return;
    player.name = input.name;
    player.team = input.team;
    player.position = input.position;
    player.playerId = input.playerId;
    player.injuryStatus = input.injuryStatus;

    let newZone: string;
    if (input.destination === "keep") {
      const accepted = ACCEPT[player.zone] || [];
      newZone = accepted.includes(input.position) ? player.zone : `backup-${input.position}`;
    } else if (input.destination === "backup" || input.destination === "stash") {
      newZone = `${input.destination}-${input.position}`;
    } else {
      newZone = input.destination;
    }
    if (newZone !== player.zone) {
      const orders = playersInZone(players, newZone).map((p) => p.order);
      player.order = orders.length ? Math.max(...orders) + 1 : 0;
      player.zone = newZone;
    }
    commit({ ...data, players });
  }

  function removePlayer(player: DepthChartPlayer) {
    if (!data) return;
    if (!confirm(`Remove ${player.name} permanently?`)) return;
    commit({ ...data, players: data.players.filter((p) => p.id !== player.id) });
  }

  function handleDropZone(zoneKey: string, container: HTMLElement, clientY: number, playerId: string) {
    if (!data) return;
    const player = data.players.find((p) => p.id === playerId);
    if (!player) return;
    const accepted = ACCEPT[zoneKey] || POSITIONS;
    if (!accepted.includes(player.position)) {
      showToast(`${player.name} is a ${player.position} — can't go in that slot.`);
      return;
    }
    const zoneMates = playersInZone(data.players, zoneKey).filter((p) => p.id !== playerId);
    if (zoneKey.startsWith("starter-")) {
      const pos = zoneKey.split("-")[1] as keyof DepthChartSettings;
      const directCap = data.settings[pos] || 0;
      // Offense flex has no zone of its own — a position can go one over
      // its direct cap as long as the shared flex pool (across RB/WR/TE)
      // still has room, once this player's own current contribution to
      // that pool (if any) is set aside.
      const hasFlexRoom =
        OFFENSE_FLEX_SET.has(pos) &&
        offenseFlexUsed(
          data.players.filter((p) => p.id !== playerId),
          data.settings
        ) < data.settings.FLEX;
      if (zoneMates.length >= directCap && !hasFlexRoom) {
        showToast(
          OFFENSE_FLEX_SET.has(pos)
            ? `No open slots there (${directCap} max, and FLEX is full too).`
            : `No open slots there (${directCap} max).`
        );
        return;
      }
    }

    const insertIndex = computeInsertIndex(container, clientY, playerId);
    const ordered = [...zoneMates];
    ordered.splice(insertIndex, 0, player);

    const players = data.players.map((p) => (p.id === playerId ? { ...p, zone: zoneKey } : p));
    ordered.forEach((op, idx) => {
      const i = players.findIndex((p) => p.id === op.id);
      if (i !== -1) players[i] = { ...players[i], order: idx };
    });

    const next = { ...data, players };
    commit(next);

    if (zoneKey.startsWith("backup-") || zoneKey.startsWith("stash-")) {
      const benchCount = totalBenchCount(next.players);
      if (benchCount > next.settings.BENCH) showToast(`Bench is over your set limit (${next.settings.BENCH})`);
    } else if (zoneKey === "ir" && playersInZone(next.players, "ir").length > next.settings.IR) {
      showToast(`IR is over your set limit (${next.settings.IR})`);
    } else if (zoneKey === "taxi" && playersInZone(next.players, "taxi").length > next.settings.TAXI) {
      showToast(`Taxi squad is over your set limit (${next.settings.TAXI})`);
    }
  }

  function handleDragStartCard(e: React.DragEvent<HTMLDivElement>, player: DepthChartPlayer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", player.id);
    setDraggingId(player.id);
  }

  function handleDragEndCard() {
    setDraggingId(null);
    setHoverZone(null);
  }

  function applySettings() {
    if (!data) return;
    commit({ ...data, settings: draft });
    showToast("Settings applied");
  }

  function resetAll() {
    if (!confirm("Reset all players and settings for this team? This cannot be undone.")) return;
    const next = emptyDepthChartData();
    commit(next);
    setDraft(next.settings);
    showToast("Everything reset");
  }

  function openAddModal() {
    lastPickedNameRef.current = null;
    setForm({ id: null, name: "", position: "QB", team: "", playerId: null, injuryStatus: null, destination: "backup" });
    setSuggestions([]);
    setModalMode("add");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function openEditModal(player: DepthChartPlayer) {
    lastPickedNameRef.current = null;
    setForm({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team ?? "",
      playerId: player.playerId,
      injuryStatus: player.injuryStatus,
      destination: "keep",
    });
    setSuggestions([]);
    setModalMode("edit");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  }

  function pickSuggestion(p: PlayerRow) {
    const mapped = mapToDepthChartPosition(p.position);
    lastPickedNameRef.current = p.full_name;
    setForm((f) => ({
      ...f,
      name: p.full_name,
      team: p.team ?? "",
      playerId: p.player_id,
      injuryStatus: p.injury_status,
      position: mapped ?? f.position,
    }));
    setSuggestions([]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const stay = submitter?.name === "stay";

    const name = form.name.trim();
    if (!name) {
      showToast("Enter a player name");
      nameInputRef.current?.focus();
      return;
    }
    const team = form.team.trim() || null;

    if (modalMode === "edit" && form.id) {
      editPlayer(form.id, {
        name,
        position: form.position,
        team,
        playerId: form.playerId,
        injuryStatus: form.injuryStatus,
        destination: form.destination,
      });
      setModalMode("closed");
      showToast(`${name} updated`);
      return;
    }

    addPlayer({
      name,
      position: form.position,
      team,
      playerId: form.playerId,
      injuryStatus: form.injuryStatus,
      destination: form.destination,
    });

    if (stay) {
      lastPickedNameRef.current = null;
      setForm((f) => ({ ...f, name: "", team: "", playerId: null, injuryStatus: null }));
      showToast(`${name} added — add another`);
      nameInputRef.current?.focus();
    } else {
      setModalMode("closed");
      showToast(`${name} added`);
    }
  }

  const dropZoneHandlers = {
    hoverZone,
    setHoverZone,
    draggingId,
    onDragStartCard: handleDragStartCard,
    onDragEndCard: handleDragEndCard,
    onDropZone: handleDropZone,
    onEdit: openEditModal,
    onRemove: removePlayer,
  };

  const idpVisible = useMemo(() => {
    if (!data) return false;
    return ["DL", "LB", "DB", "IDPFLEX"].some((pos) => (data.settings[pos as keyof DepthChartSettings] || 0) > 0);
  }, [data]);

  if (loading || !data) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  function renderPositionColumn(pos: string) {
    if (!data) return null;
    const count = data.settings[pos as keyof DepthChartSettings] ?? 0;
    const isFlex = FLEX_TYPES.includes(pos);
    const isOffenseFlexEligible = OFFENSE_FLEX_SET.has(pos);
    // A position with zero dedicated starter slots still needs its own
    // column — and bench/stash space — whenever it can fill a flex slot
    // (e.g. an IDP-flex-only league has DL/LB/DB all at 0 but still needs
    // somewhere to bench those players) or already has players rostered
    // there from before a settings change.
    const flexEligible =
      !isFlex &&
      ((isOffenseFlexEligible && data.settings.FLEX > 0) ||
        (["DL", "LB", "DB"].includes(pos) && data.settings.IDPFLEX > 0));
    const hasRosteredPlayers =
      !isFlex && RESERVE_KINDS.some((kind) => playersInZone(data.players, `${kind}-${pos}`).length > 0);
    if (count <= 0 && !flexEligible && !hasRosteredPlayers) return null;
    const zoneKey = `starter-${pos}`;
    const starters = playersInZone(data.players, zoneKey);
    // Offense flex has no zone of its own — anyone beyond this position's
    // own direct count is "the extra" filling the shared flex pool instead.
    const flexExtraIds = isOffenseFlexEligible ? new Set(starters.slice(count).map((p) => p.id)) : undefined;
    const label = pos === "IDPFLEX" ? "IDP FLEX (DL/LB/DB)" : posFullName(pos);
    const chipLabel = pos === "IDPFLEX" ? "FLX" : pos;

    return (
      <div key={pos} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
            <span
              className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                isFlex
                  ? "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                  : positionBadgeClasses(pos)
              }`}
            >
              {chipLabel}
            </span>
            <span className="truncate">{label}</span>
          </div>
          <CountBadge filled={starters.length} capacity={count} />
        </div>

        <DropZone
          zoneKey={zoneKey}
          players={starters}
          flexExtraIds={flexExtraIds}
          emptyText="Drop players here"
          {...dropZoneHandlers}
        />

        {!isFlex ? (
          RESERVE_KINDS.map((kind) => {
            const reserveZoneKey = `${kind}-${pos}`;
            const reservePlayers = playersInZone(data.players, reserveZoneKey);
            return (
              <div key={kind} className="flex flex-col gap-1 border-t border-dashed border-neutral-200 pt-1.5 dark:border-neutral-800">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  <span>{kind === "backup" ? "Backups" : "Stashes"}</span>
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                    {reservePlayers.length}
                  </span>
                </div>
                <DropZone zoneKey={reserveZoneKey} players={reservePlayers} compact emptyText="Empty" {...dropZoneHandlers} />
              </div>
            );
          })
        ) : (
          <p className="border-t border-dashed border-neutral-200 pt-1.5 text-[10px] italic text-neutral-500 dark:border-neutral-800">
            IDP Flex accepts DL / LB / DB — drag eligible players from their backup/stash sections.
          </p>
        )}
      </div>
    );
  }

  const benchFilled = totalBenchCount(data.players);
  const flexFilled = offenseFlexUsed(data.players, data.settings);
  const irPlayers = playersInZone(data.players, "ir");
  const taxiPlayers = playersInZone(data.players, "taxi");
  const cutPlayers = playersInZone(data.players, "cut");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{leagueName ? `${leagueName} — Depth Chart` : "Depth Chart"}</h1>
          <p className="text-sm text-neutral-500">Starters on top, backups and stashes organized below by position.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openAddModal}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            + Add Player
          </button>
          <button
            onClick={() => setPasteOpen(true)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Paste Roster
          </button>
          <button
            onClick={() => setSleeperOpen(true)}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            title="Prototype: pull starters/bench/IR/taxi straight from Sleeper's API"
          >
            Sync from Sleeper
          </button>
          <button
            onClick={resetAll}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            Reset All
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">League Roster Settings</h3>
          <span className={`text-xs text-neutral-500 transition-transform ${settingsOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
        {settingsOpen && (
          <div className="space-y-4 border-t border-neutral-200 px-4 py-4 dark:border-neutral-800">
            <div>
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Offense Starters</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {(["QB", "RB", "WR", "TE", "FLEX", "K", "P", "DEF"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
                    {k} Starters
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                IDP Starters (Individual Defensive Players)
              </h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {(["DL", "LB", "DB", "IDPFLEX"] as const).map((k) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
                    {k === "IDPFLEX" ? "IDP FLEX Starters" : `${k} Starters`}
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>
                ))}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Reserves</h4>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(
                  [
                    ["BENCH", "Bench Spots", 40],
                    ["IR", "IR Spots", 10],
                    ["TAXI", "Taxi Squad Spots", 10],
                  ] as const
                ).map(([k, label, max]) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
                    {label}
                    <input
                      type="number"
                      min={0}
                      max={max}
                      value={draft[k]}
                      onChange={(e) => setDraft((d) => ({ ...d, [k]: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      className="rounded border border-neutral-300 px-2 py-1.5 text-sm font-semibold text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                    />
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={applySettings}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Apply Settings
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold">Roster</h2>
          <CountBadge filled={benchFilled} capacity={data.settings.BENCH} />
          <span className="text-xs text-neutral-500">bench</span>
          {data.settings.FLEX > 0 && (
            <>
              <CountBadge filled={flexFilled} capacity={data.settings.FLEX} />
              <span className="text-xs text-neutral-500">flex</span>
            </>
          )}
        </div>

        <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400">Offense</h3>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
          {(["QB", "RB", "WR", "TE", "K", "P", "DEF"] as const).map((pos) => renderPositionColumn(pos))}
        </div>

        {idpVisible && (
          <>
            <h3 className="pt-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
              IDP — Individual Defensive Players
            </h3>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
              {(["DL", "LB", "DB", "IDPFLEX"] as const).map((pos) => renderPositionColumn(pos))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            Injured Reserve <CountBadge filled={irPlayers.length} capacity={data.settings.IR} />
          </h2>
          <DropZone zoneKey="ir" players={irPlayers} emptyText="Drop players here" {...dropZoneHandlers} />
        </div>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            Taxi Squad <CountBadge filled={taxiPlayers.length} capacity={data.settings.TAXI} />
          </h2>
          <DropZone
            zoneKey="taxi"
            players={taxiPlayers}
            emptyText="Drop players here"
            borderClassName="border-amber-300 dark:border-amber-900"
            {...dropZoneHandlers}
          />
        </div>
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            Cut / Trade Block
            <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
              {cutPlayers.length}
            </span>
          </h2>
          <DropZone
            zoneKey="cut"
            players={cutPlayers}
            emptyText="Drop players here"
            borderClassName="border-red-300 dark:border-red-900"
            {...dropZoneHandlers}
          />
        </div>
      </div>

      {modalMode !== "closed" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalMode("closed");
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-4 text-lg font-semibold">{modalMode === "edit" ? "Edit Player" : "Add Player"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <label className="mb-1 block text-xs font-medium text-neutral-500">Name</label>
                <input
                  ref={nameInputRef}
                  value={form.name}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => ({ ...f, name: value, playerId: value === lastPickedNameRef.current ? f.playerId : null }));
                  }}
                  placeholder="e.g. Justin Jefferson"
                  autoComplete="off"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded border border-neutral-300 bg-white shadow dark:border-neutral-700 dark:bg-neutral-900">
                    {suggestions.map((p) => (
                      <li key={p.player_id}>
                        <button
                          type="button"
                          onClick={() => pickSuggestion(p)}
                          className="block w-full px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          {p.full_name} — {p.position} {p.team}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Position</span>
                <select
                  value={form.position}
                  onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <optgroup label="Offense">
                    <option value="QB">QB — Quarterback</option>
                    <option value="RB">RB — Running Back</option>
                    <option value="WR">WR — Wide Receiver</option>
                    <option value="TE">TE — Tight End</option>
                    <option value="K">K — Kicker</option>
                    <option value="P">P — Punter</option>
                    <option value="DEF">DEF — Team Defense</option>
                  </optgroup>
                  <optgroup label="IDP">
                    <option value="DL">DL — Defensive Line</option>
                    <option value="LB">LB — Linebacker</option>
                    <option value="DB">DB — Defensive Back</option>
                  </optgroup>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Add To</span>
                <select
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                  {modalMode === "edit" && <option value="keep">Keep Current Spot</option>}
                  <option value="backup">Backups</option>
                  <option value="stash">Stashes</option>
                  <option value="taxi">Taxi Squad</option>
                  <option value="ir">Injured Reserve</option>
                  <option value="cut">Cut / Trade Block</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">NFL Team (optional)</span>
                <input
                  value={form.team}
                  onChange={(e) => setForm((f) => ({ ...f, team: e.target.value }))}
                  placeholder="e.g. MIN"
                  autoComplete="off"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode("closed")}
                  className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                >
                  Cancel
                </button>
                {modalMode === "add" && (
                  <button
                    type="submit"
                    name="stay"
                    value="1"
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                  >
                    Save &amp; Add Another
                  </button>
                )}
                <button
                  type="submit"
                  className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
                >
                  {modalMode === "edit" ? "Save Changes" : "Add Player"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pasteOpen && (
        <PasteRosterModal settings={data.settings} onImport={importPlayers} onClose={() => setPasteOpen(false)} />
      )}

      {sleeperOpen && (
        <SleeperSyncModal
          sleeperLeagueId={sleeperLeagueId}
          sleeperRosterId={sleeperRosterId}
          onSync={(synced) => {
            commit(synced);
            showToast("Synced from Sleeper");
          }}
          onClose={() => setSleeperOpen(false)}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white dark:text-neutral-900">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
