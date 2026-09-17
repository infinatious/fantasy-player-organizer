"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PlatformBadge } from "@/components/PlatformBadge";
import type { Platform } from "@/lib/platforms";
import { type DepthChartPlayer, STARTER_ORDER, normalizeDepthChartData } from "@/lib/depthChart";
import { playerImageUrl } from "@/lib/teamColors";
import { withBasePath } from "@/lib/basePath";

interface League {
  id: number;
  name: string;
  platform: Platform;
  weight: number;
  team_name: string | null;
}

function starterPosition(zone: string): string {
  return zone.slice("starter-".length);
}

function sortedStarters(players: DepthChartPlayer[]): DepthChartPlayer[] {
  return players
    // Team defenses render as a team logo, not a headshot — out of place
    // among the actual player photos in this row.
    .filter((p) => p.zone.startsWith("starter-") && p.position !== "DEF")
    .sort((a, b) => {
      const posA = STARTER_ORDER.indexOf(starterPosition(a.zone));
      const posB = STARTER_ORDER.indexOf(starterPosition(b.zone));
      if (posA !== posB) return posA - posB;
      return a.order - b.order;
    });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// The tooltip renders through a portal to document.body, positioned by its
// own fixed coordinates rather than living inside the avatar. Two rounds of
// fixes tried to keep it inline: it was getting clipped by the row's
// horizontal-overflow container (edge avatars) and painted underneath
// higher-stacked avatars from the same row or from other league cards
// (since each avatar's z-index only wins locally, not page-wide). A portal
// with a flat, page-level z-index sidesteps both — it isn't a descendant of
// any clipping/stacking ancestor anymore.
function StarterAvatar({ player, zIndex }: { player: DepthChartPlayer; zIndex: number }) {
  const [imgError, setImgError] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function showTooltip() {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ left: rect.left + rect.width / 2, top: rect.top });
  }

  return (
    <div
      ref={ref}
      className="relative -ml-6 shrink-0 first:ml-0"
      style={{ zIndex }}
      onMouseEnter={showTooltip}
      onMouseLeave={() => setTooltipPos(null)}
    >
      {player.playerId && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={playerImageUrl(player.playerId, player.position)}
          alt=""
          className="block h-[3.75rem] w-auto shrink-0 drop-shadow-sm"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-neutral-200 text-sm font-semibold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          {initials(player.name)}
        </div>
      )}
      {tooltipPos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[999] -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white shadow dark:bg-white dark:text-neutral-900"
            style={{ left: tooltipPos.left, top: tooltipPos.top }}
          >
            {player.name} · {player.position}
            {player.team ? ` ${player.team}` : ""}
          </div>,
          document.body
        )}
    </div>
  );
}

interface LeagueFormState {
  name: string;
  teamName: string;
  platform: Platform;
  weight: number;
}

const EMPTY_FORM: LeagueFormState = { name: "", teamName: "", platform: "sleeper", weight: 5 };

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [starters, setStarters] = useState<Record<number, DepthChartPlayer[]>>({});
  const [loading, setLoading] = useState(true);

  const [modalMode, setModalMode] = useState<"closed" | "add" | "edit">("closed");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<LeagueFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(withBasePath("/api/leagues"));
    const data = await res.json();
    const list: League[] = data.leagues ?? [];
    setLeagues(list);

    const entries = await Promise.all(
      list.map(async (l) => {
        const r = await fetch(withBasePath(`/api/depth-chart/${l.id}`));
        const d = await r.json();
        const normalized = normalizeDepthChartData(d.data);
        return [l.id, sortedStarters(normalized.players)] as const;
      })
    );
    setStarters(Object.fromEntries(entries));
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalMode("add");
  }

  function openEditModal(l: League) {
    setEditingId(l.id);
    setForm({ name: l.name, teamName: l.team_name ?? "", platform: l.platform, weight: l.weight });
    setModalMode("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const body = JSON.stringify({
      name: form.name.trim(),
      team_name: form.teamName.trim() || null,
      platform: form.platform,
      weight: form.weight,
    });
    if (modalMode === "edit" && editingId) {
      await fetch(withBasePath(`/api/leagues/${editingId}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    } else {
      await fetch(withBasePath("/api/leagues"), { method: "POST", headers: { "Content-Type": "application/json" }, body });
    }
    setSaving(false);
    setModalMode("closed");
    await load();
  }

  async function removeLeague(id: number) {
    if (!confirm("Delete this league and all its saved rosters?")) return;
    await fetch(withBasePath(`/api/leagues/${id}`), { method: "DELETE" });
    setModalMode("closed");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leagues</h1>
          <p className="text-sm text-neutral-500">
            Add each fantasy league you play in. You&apos;ll paste rosters per league every week.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          + Add League
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-neutral-500">No leagues yet — add one to get started.</p>
      ) : (
        <div className="space-y-4">
          {leagues.map((l) => (
            <div key={l.id} className="rounded-lg border border-neutral-200 bg-white pt-1 pr-4 pl-4 dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => openEditModal(l)}
                  title="Edit league"
                  className="group/edit relative shrink-0 rounded-full"
                >
                  <PlatformBadge platform={l.platform} />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-sm text-white opacity-0 transition-opacity group-hover/edit:opacity-100">
                    ✎
                  </span>
                </button>
                <Link href={`/depth-charts/${l.id}`} className="group shrink-0">
                  <p className="font-semibold leading-tight group-hover:underline">{l.team_name || l.name}</p>
                  {l.team_name && <p className="text-xs text-neutral-500">{l.name}</p>}
                </Link>
                {(starters[l.id]?.length ?? 0) === 0 ? (
                  <p className="min-w-0 flex-1 text-xs text-neutral-500">
                    No starters set yet —{" "}
                    <Link href={`/depth-charts/${l.id}`} className="text-blue-600 hover:underline">
                      set up this team&apos;s depth chart
                    </Link>
                    .
                  </p>
                ) : (
                  // Fades trailing headshots into the card background instead of a hard
                  // clip. A real mask (rather than a color-matched overlay div) fades the
                  // actual pixels regardless of theme, and reliably covers whatever avatar
                  // lands at the edge — an overlay anchored to a fixed pixel width could
                  // land past the last visible avatar and render as no fade at all. Safe to
                  // mask now that the tooltip renders through a portal instead of living
                  // inside this container.
                  <div
                    className="flex min-w-0 flex-1 items-center overflow-x-hidden"
                    style={{
                      maskImage: "linear-gradient(to right, black calc(100% - 64px), transparent)",
                      WebkitMaskImage: "linear-gradient(to right, black calc(100% - 64px), transparent)",
                    }}
                  >
                    {starters[l.id].map((p, i) => (
                      <StarterAvatar key={p.id} player={p} zIndex={starters[l.id].length - i} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode !== "closed" && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalMode("closed");
          }}
        >
          <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="mb-4 text-lg font-semibold">{modalMode === "edit" ? "Edit League" : "Add League"}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">League name</span>
                <input
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Work League"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Team name (optional)</span>
                <input
                  value={form.teamName}
                  onChange={(e) => setForm((f) => ({ ...f, teamName: e.target.value }))}
                  placeholder="e.g. The Gridiron Gurus"
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Platform</span>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="sleeper">Sleeper</option>
                  <option value="espn">ESPN</option>
                  <option value="yahoo">Yahoo!</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-neutral-500">Importance (1–10)</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.weight}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, weight: Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)) }))
                  }
                  className="w-full rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                />
                <span className="mt-1 block text-[11px] text-neutral-500">
                  Controls how much this league counts toward each player&apos;s rooting score — set
                  money/serious leagues higher, just-for-fun leagues lower.
                </span>
              </label>

              <div className="flex items-center justify-between gap-2 pt-2">
                {modalMode === "edit" && editingId ? (
                  <button
                    type="button"
                    onClick={() => removeLeague(editingId)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Delete League
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalMode("closed")}
                    className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !form.name.trim()}
                    className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
                  >
                    {saving ? "Saving…" : modalMode === "edit" ? "Save Changes" : "Add League"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
