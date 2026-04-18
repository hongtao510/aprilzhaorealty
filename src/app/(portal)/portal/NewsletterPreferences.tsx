"use client";

import { useState } from "react";

interface Props {
  cities: string[];
  initialSelected: string[];
}

export function NewsletterPreferences({ cities, initialSelected }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const initialSet = new Set(initialSelected);
  const dirty =
    selected.size !== initialSet.size ||
    Array.from(selected).some((c) => !initialSet.has(c));

  function toggle(city: string) {
    const next = new Set(selected);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    setSelected(next);
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: Array.from(selected) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage({ kind: "err", text: data?.error ?? "Failed to save." });
      setSaving(false);
      return;
    }
    setMessage({ kind: "ok", text: "Preferences saved." });
    setSaving(false);
  }

  async function unsubscribeAll() {
    if (!confirm("Unsubscribe from all new-listing emails?")) return;
    setSelected(new Set());
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cities: [] }),
    });
    if (!res.ok) {
      setMessage({ kind: "err", text: "Failed to unsubscribe." });
      setSaving(false);
      return;
    }
    setMessage({ kind: "ok", text: "You've been unsubscribed from all cities." });
    setSaving(false);
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {cities.map((city) => (
          <label key={city} className="flex items-center gap-3 cursor-pointer p-3 border border-neutral-200 hover:border-[#d4a012] transition-colors bg-white">
            <input
              type="checkbox"
              checked={selected.has(city)}
              onChange={() => toggle(city)}
              className="accent-[#d4a012]"
            />
            <span className="text-sm text-neutral-900">{city}</span>
          </label>
        ))}
      </div>

      {message && (
        <p className={`text-sm mb-4 ${message.kind === "ok" ? "text-[#d4a012]" : "text-red-600"}`}>
          {message.text}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="px-12 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={selected.size === 0 && initialSet.size === 0}
          className="px-12 py-3 border border-neutral-300 text-neutral-600 text-xs font-medium uppercase tracking-[0.15em] hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          Unsubscribe from all
        </button>
      </div>
    </div>
  );
}
