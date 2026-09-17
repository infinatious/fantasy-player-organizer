"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlatformBadge } from "@/components/PlatformBadge";
import type { Platform } from "@/lib/platforms";
import { type DepthChartPlayer, STARTER_ORDER, normalizeDepthChartData } from "@/lib/depthChart";
import { playerImageUrl } from "@/lib/teamColors";

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
    .filter((p) => p.zone.startsWith("starter-"))
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

function StarterAvatar({ player, zIndex }: { player: DepthChartPlayer; zIndex: number }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="group relative -ml-6 shrink-0 first:ml-0" style={{ zIndex }}>
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
      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 dark:bg-white dark:text-neutral-900">
        {player.name} · {player.position}
        {player.team ? ` ${player.team}` : ""}
      </div>
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
    const res = await fetch("/api/leagues");
    const data = await res.json();
    const list: League[] = data.leagues ?? [];
    setLeagues(list);

    const entries = await Promise.all(
      list.map(async (l) => {
        const r = await fetch(`/api/depth-chart/${l.id}`);
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
      await fetch(`/api/leagues/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body });
    } else {
      await fetch("/api/leagues", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    }
    setSaving(false);
    setModalMode("closed");
    await load();
  }

  async function removeLeague(id: number) {
    if (!confirm("Delete this league and all its saved rosters?")) return;
    await fetch(`/api/leagues/${id}`, { method: "DELETE" });
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
                  <div className="relative flex min-w-0 flex-1 items-center overflow-x-hidden">
                    {starters[l.id].map((p, i) => (
                      <StarterAvatar key={p.id} player={p} zIndex={starters[l.id].length - i} />
                    ))}
                    {/* Fades trailing headshots into the card background instead of a hard
                        clip — a plain overlay rather than a mask so it can't affect the
                        tooltips, which need to stay at full opacity even in this zone. */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent to-white dark:to-neutral-900" />
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
