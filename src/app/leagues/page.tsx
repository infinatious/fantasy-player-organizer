"use client";

import { useEffect, useState } from "react";

interface League {
  id: number;
  name: string;
  platform: "sleeper" | "espn" | "yahoo";
  weight: number;
}

const PLATFORM_LABEL: Record<League["platform"], string> = {
  sleeper: "Sleeper",
  espn: "ESPN",
  yahoo: "Yahoo!",
};

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<League["platform"]>("sleeper");
  const [weight, setWeight] = useState(5);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/leagues");
    const data = await res.json();
    setLeagues(data.leagues);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, []);

  async function addLeague(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/leagues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), platform, weight }),
    });
    setName("");
    setWeight(5);
    await load();
    setSaving(false);
  }

  async function removeLeague(id: number) {
    if (!confirm("Delete this league and all its saved rosters?")) return;
    await fetch(`/api/leagues/${id}`, { method: "DELETE" });
    await load();
  }

  const [savedId, setSavedId] = useState<number | null>(null);

  async function updateWeight(id: number, newWeight: number) {
    setLeagues((prev) => prev.map((l) => (l.id === id ? { ...l, weight: newWeight } : l)));
    await fetch(`/api/leagues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight: newWeight }),
    });
    setSavedId(id);
    setTimeout(() => setSavedId((current) => (current === id ? null : current)), 1200);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Leagues</h1>
        <p className="text-sm text-neutral-500">
          Add each fantasy league you play in. You&apos;ll paste rosters per league every week.
        </p>
      </div>

      <form onSubmit={addLeague} className="flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">League name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Work League"
            className="w-56 rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as League["platform"])}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            <option value="sleeper">Sleeper</option>
            <option value="espn">ESPN</option>
            <option value="yahoo">Yahoo!</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500">Importance (1–10)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={weight}
            onChange={(e) => setWeight(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-20 rounded border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          Add League
        </button>
      </form>
      <p className="-mt-4 text-xs text-neutral-500">
        Importance controls how much this league counts toward each player&apos;s rooting score on the
        dashboard — set money/serious leagues higher, just-for-fun leagues lower.
      </p>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : leagues.length === 0 ? (
        <p className="text-sm text-neutral-500">No leagues yet — add one above.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {leagues.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <span className="font-medium">{l.name}</span>
                <span className="ml-2 rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {PLATFORM_LABEL[l.platform]}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-neutral-500">
                  Importance
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={l.weight}
                    onChange={(e) => updateWeight(l.id, Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                    className="w-16 rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <span className="w-10 text-green-600">{savedId === l.id ? "Saved" : ""}</span>
                </label>
                <button onClick={() => removeLeague(l.id)} className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
