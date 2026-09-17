"use client";

import { useState } from "react";
import type { DepthChartData } from "@/lib/depthChart";
import { withBasePath } from "@/lib/basePath";

// The league's Sleeper connection (which league ID + which roster is yours)
// is entered once on the league's edit screen (Leagues → pencil icon) —
// this only needs to confirm and pull the data.
export function SleeperSyncModal({
  sleeperLeagueId,
  sleeperRosterId,
  onSync,
  onClose,
}: {
  sleeperLeagueId: string | null;
  sleeperRosterId: number | null;
  onSync: (data: DepthChartData) => void;
  onClose: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = !!sleeperLeagueId && sleeperRosterId !== null;

  async function sync() {
    if (!configured) return;
    if (!confirm("This replaces the entire depth chart on this board with what Sleeper has. Continue?")) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/sleeper/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleeperLeagueId, rosterId: sleeperRosterId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      onSync(json.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    }
    setSyncing(false);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
        <h3 className="mb-1 text-lg font-semibold">Sync from Sleeper</h3>

        {configured ? (
          <>
            <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
              Prototype — replaces this board&apos;s starters, bench, IR, and taxi with roster{" "}
              <span className="font-mono">{sleeperRosterId}</span> from Sleeper league{" "}
              <span className="font-mono">{sleeperLeagueId}</span>.
            </p>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
            This league isn&apos;t connected to Sleeper yet. Set the Sleeper league ID and pick your team from the
            league&apos;s edit screen (Leagues → pencil icon on the platform badge → Sleeper connection).
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            {configured ? "Cancel" : "Close"}
          </button>
          {configured && (
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {syncing ? "Syncing…" : "Sync This Team"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
