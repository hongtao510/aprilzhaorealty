"use client";

import { useState } from "react";

export interface ListingFilters {
  property_types: string[];
  price_ranges: string[];
  sqft_ranges: string[];
  min_beds: number | null;
  min_baths: number | null;
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

// Price buckets. `key` is the stable identifier stored in the DB.
export const PRICE_RANGES = [
  { key: "0-1m", label: "Under $1M" },
  { key: "1m-1.5m", label: "$1M – $1.5M" },
  { key: "1.5m-2m", label: "$1.5M – $2M" },
  { key: "2m-2.5m", label: "$2M – $2.5M" },
  { key: "2.5m-3m", label: "$2.5M – $3M" },
  { key: "3m-4m", label: "$3M – $4M" },
  { key: "4m-5m", label: "$4M – $5M" },
  { key: "5m+", label: "$5M+" },
];

// Sqft buckets.
export const SQFT_RANGES = [
  { key: "0-1000", label: "Under 1,000" },
  { key: "1000-1500", label: "1,000 – 1,500" },
  { key: "1500-2000", label: "1,500 – 2,000" },
  { key: "2000-2500", label: "2,000 – 2,500" },
  { key: "2500-3000", label: "2,500 – 3,000" },
  { key: "3000-4000", label: "3,000 – 4,000" },
  { key: "4000+", label: "4,000+" },
];

const BED_OPTIONS = [1, 2, 3, 4, 5, 6];
const BATH_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5];

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function MultiChip({
  options,
  selected,
  onToggle,
}: {
  options: { key?: string; value?: string; label: string }[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const val = opt.key ?? opt.value!;
        const active = selected.has(val);
        return (
          <button
            key={val}
            type="button"
            onClick={() => onToggle(val)}
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
  );
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
  const [priceRanges, setPriceRanges] = useState<Set<string>>(
    new Set(initialFilters.price_ranges)
  );
  const [sqftRanges, setSqftRanges] = useState<Set<string>>(
    new Set(initialFilters.sqft_ranges)
  );
  const [minBeds, setMinBeds] = useState<string>(
    initialFilters.min_beds?.toString() ?? ""
  );
  const [minBaths, setMinBaths] = useState<string>(
    initialFilters.min_baths?.toString() ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  function makeToggle(setter: React.Dispatch<React.SetStateAction<Set<string>>>) {
    return (value: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
      setMessage(null);
    };
  }

  function toggleCity(city: string) {
    const next = new Set(selected);
    if (next.has(city)) next.delete(city);
    else next.add(city);
    setSelected(next);
    setMessage(null);
  }

  function currentPayload() {
    return {
      cities: Array.from(selected),
      filter_property_types: Array.from(propTypes),
      filter_price_ranges: Array.from(priceRanges),
      filter_sqft_ranges: Array.from(sqftRanges),
      filter_min_beds: num(minBeds),
      filter_min_baths: num(minBaths),
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
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Property type
            </label>
            <MultiChip
              options={PROPERTY_TYPE_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              selected={propTypes}
              onToggle={makeToggle(setPropTypes)}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Price range
            </label>
            <MultiChip
              options={PRICE_RANGES}
              selected={priceRanges}
              onToggle={makeToggle(setPriceRanges)}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Home size (sqft)
            </label>
            <MultiChip
              options={SQFT_RANGES}
              selected={sqftRanges}
              onToggle={makeToggle(setSqftRanges)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min beds
              </label>
              <select
                value={minBeds}
                onChange={(e) => {
                  setMinBeds(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012] text-neutral-900"
              >
                <option value="">Any</option>
                {BED_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}+
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
                Min baths
              </label>
              <select
                value={minBaths}
                onChange={(e) => {
                  setMinBaths(e.target.value);
                  setMessage(null);
                }}
                className="w-full px-0 py-2 bg-transparent border-0 border-b-2 border-neutral-200 focus:outline-none focus:border-[#d4a012] text-neutral-900"
              >
                <option value="">Any</option>
                {BATH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}+
                  </option>
                ))}
              </select>
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
