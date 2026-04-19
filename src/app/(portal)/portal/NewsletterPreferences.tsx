"use client";

import { useState } from "react";

export interface ListingFilters {
  property_types: string[];
  min_price: number | null;
  max_price: number | null;
  min_beds: number | null;
  min_baths: number | null;
  min_sqft: number | null;
  max_sqft: number | null;
}

interface Props {
  cities: string[];
  initialSelected: string[];
  initialFilters: ListingFilters;
}

const PROPERTY_TYPE_OPTIONS = [
  { value: "Single Family Residential", label: "Single Family" },
  { value: "Condo/Co-op", label: "Condo" },
  { value: "Townhouse", label: "Townhouse" },
];

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function NewsletterPreferences({
  cities,
  initialSelected,
  initialFilters,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected)
  );
  const [propTypes, setPropTypes] = useState<Set<string>>(
    new Set(initialFilters.property_types)
  );
  const [minPrice, setMinPrice] = useState<string>(
    initialFilters.min_price?.toString() ?? ""
  );
  const [maxPrice, setMaxPrice] = useState<string>(
    initialFilters.max_price?.toString() ?? ""
  );
  const [minBeds, setMinBeds] = useState<string>(
    initialFilters.min_beds?.toString() ?? ""
  );
  const [minBaths, setMinBaths] = useState<string>(
    initialFilters.min_baths?.toString() ?? ""
  );
  const [minSqft, setMinSqft] = useState<string>(
    initialFilters.min_sqft?.toString() ?? ""
  );
  const [maxSqft, setMaxSqft] = useState<string>(
    initialFilters.max_sqft?.toString() ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function toggleCity(city: string) {
    const next = new Set(selected);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    setSelected(next);
    setMessage(null);
  }

  function togglePropType(t: string) {
    const next = new Set(propTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setPropTypes(next);
    setMessage(null);
  }

  function currentPayload() {
    return {
      cities: Array.from(selected),
      filter_property_types: Array.from(propTypes),
      filter_min_price: num(minPrice),
      filter_max_price: num(maxPrice),
      filter_min_beds: num(minBeds),
      filter_min_baths: num(minBaths),
      filter_min_sqft: num(minSqft),
      filter_max_sqft: num(maxSqft),
    };
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentPayload()),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setMessage({
        kind: "err",
        text: data?.error ?? "Failed to save.",
      });
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
      body: JSON.stringify({
        ...currentPayload(),
        cities: [],
      }),
    });
    if (!res.ok) {
      setMessage({ kind: "err", text: "Failed to unsubscribe." });
      setSaving(false);
      return;
    }
    setMessage({
      kind: "ok",
      text: "You've been unsubscribed from all cities.",
    });
    setSaving(false);
  }

  return (
    <div className="space-y-10">
      {/* Cities */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
          Cities
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cities.map((city) => (
            <label
              key={city}
              className="flex items-center gap-3 cursor-pointer p-3 border border-neutral-200 hover:border-[#d4a012] transition-colors bg-white"
            >
              <input
                type="checkbox"
                checked={selected.has(city)}
                onChange={() => toggleCity(city)}
                className="accent-[#d4a012]"
              />
              <span className="text-sm text-neutral-900">{city}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-4">
          Filters{" "}
          <span className="text-neutral-400 normal-case tracking-normal">
            (optional — leave blank for no limit)
          </span>
        </h3>

        <div className="space-y-6">
          {/* Property type */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Property type
            </label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPE_OPTIONS.map((opt) => {
                const active = propTypes.has(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePropType(opt.value)}
                    className={`px-4 py-2 text-xs uppercase tracking-wider border transition-colors ${
                      active
                        ? "bg-[#d4a012] text-white border-[#d4a012]"
                        : "bg-white text-neutral-600 border-neutral-300 hover:border-[#d4a012]"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min price
              </label>
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={minPrice}
                  onChange={(e) => {
                    setMinPrice(e.target.value);
                    setMessage(null);
                  }}
                  className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                  placeholder="any"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Max price
              </label>
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={maxPrice}
                  onChange={(e) => {
                    setMaxPrice(e.target.value);
                    setMessage(null);
                  }}
                  className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                  placeholder="any"
                />
              </div>
            </div>
          </div>

          {/* Beds + Baths */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min beds
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={1}
                value={minBeds}
                onChange={(e) => {
                  setMinBeds(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                placeholder="any"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min baths
              </label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={minBaths}
                onChange={(e) => {
                  setMinBaths(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                placeholder="any"
              />
            </div>
          </div>

          {/* Sqft */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min sqft
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={minSqft}
                onChange={(e) => {
                  setMinSqft(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                placeholder="any"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Max sqft
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={maxSqft}
                onChange={(e) => {
                  setMaxSqft(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012]"
                placeholder="any"
              />
            </div>
          </div>
        </div>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.kind === "ok" ? "text-[#d4a012]" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-12 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
        <button
          type="button"
          onClick={unsubscribeAll}
          disabled={saving}
          className="px-12 py-3 border border-neutral-300 text-neutral-600 text-xs font-medium uppercase tracking-[0.15em] hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          Unsubscribe from all
        </button>
      </div>
    </div>
  );
}
