"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/basePath";

// A per-deployment label (e.g. which household/tenant this instance belongs
// to) — useful once several private-path instances share one domain. Stored
// in this instance's own DB, so it's set once per deployment via the UI
// rather than as a build-time env var.
export function TenantName() {
  const [name, setName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(withBasePath("/api/settings"));
      const data = await res.json();
      setName(data.tenantName ?? null);
      setLoaded(true);
    })();
  }, []);

  async function save() {
    const trimmed = draft.trim();
    setEditing(false);
    setName(trimmed || null);
    await fetch(withBasePath("/api/settings"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantName: trimmed }),
    });
  }

  if (!loaded) return null;

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Tenant name"
        maxLength={40}
        className="w-28 rounded border border-neutral-300 bg-transparent px-1.5 py-0.5 text-xs dark:border-neutral-700"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name ?? "");
        setEditing(true);
      }}
      title="Click to name this deployment"
      className="text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
    >
      {name ?? "+ Add name"}
    </button>
  );
}
