"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CompHomeWithGeo, CompsEstimate } from "@/lib/types";

const RENOVATION_LABEL: Record<number, string> = {
  0: "Fixer / original",
  1: "Light updates",
  2: "Moderate reno",
  3: "Heavy reno",
  4: "New construction",
};

/** Haversine miles. Returns null if either side missing geo. */
function haversineMiles(
  a: { lat: number; lng: number } | null,
  b: { lat: number; lng: number } | null,
): number | null {
  if (!a || !b) return null;
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function CompPreviewCard({
  c,
  isSelected,
  computedDistance,
}: {
  c: CompHomeWithGeo;
  isSelected: boolean;
  computedDistance: number | null;
}) {
  const street = c.address.split(",")[0];
  const cityState = c.address.split(",").slice(1).join(",").trim();
  return (
    <div className="text-xs leading-snug min-w-[240px] max-w-[280px]">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div>
          <div className="font-semibold text-sm text-neutral-900">{street}</div>
          <div className="text-neutral-500">{c.city ?? cityState}</div>
        </div>
        <span
          className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium ${
            isSelected ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {isSelected ? "Included" : "Excluded"}
        </span>
      </div>

      <div className="font-semibold text-base text-neutral-900 mb-1">
        ${c.sold_price.toLocaleString()}
        <span className="text-neutral-500 font-normal text-xs ml-1">
          · ${Math.round(c.price_per_sqft).toLocaleString()}/sf
        </span>
      </div>

      <div className="text-neutral-700">
        {c.beds}bd · {c.baths}ba · {c.sqft.toLocaleString()} sqft
        {c.lot_sqft > 0 ? ` · lot ${c.lot_sqft.toLocaleString()} sqft` : ""}
        {c.year_built ? ` · built ${c.year_built}` : ""}
      </div>

      <div className="mt-1 text-neutral-500">
        Sold {c.sold_date || "—"}
        {computedDistance != null ? ` · ${computedDistance.toFixed(2)} mi away` : ""}
      </div>

      {(c.neighborhood || c.elementary_school_rating != null || c.renovation_tier != null) && (
        <div className="mt-1 flex flex-wrap gap-1">
          {c.neighborhood && (
            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-800 rounded text-[10px]">
              {c.neighborhood}
            </span>
          )}
          {c.elementary_school_rating != null && (
            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded text-[10px]">
              School {c.elementary_school_rating}/10
            </span>
          )}
          {c.renovation_tier != null && (
            <span className="px-1.5 py-0.5 bg-purple-50 text-purple-800 rounded text-[10px]">
              {RENOVATION_LABEL[c.renovation_tier] ?? `Reno ${c.renovation_tier}`}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-neutral-200 flex items-center justify-between text-[10px] text-neutral-500">
        <span>Similarity {(c.total_score ?? c.similarity_score ?? 0).toFixed(2)}</span>
        <span className="text-neutral-700 font-medium">Click to {isSelected ? "exclude" : "include"}</span>
      </div>
    </div>
  );
}

interface MapPickerProps {
  subject: { address: string; sqft: number; lot_sqft: number; latitude?: number | null; longitude?: number | null };
  candidates: CompHomeWithGeo[];
  /** redfin_urls of comps initially selected (typically the algorithm's top 8). */
  initialSelectedUrls: string[];
  onEstimateChange?: (e: CompsEstimate | null) => void;
  /** Notified whenever the selection changes — parent typically lifts the set into URL params for Phase 2. */
  onSelectionChange?: (urls: Set<string>) => void;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = points.reduce<[[number, number], [number, number]]>(
      (acc, p) => [
        [Math.min(acc[0][0], p[0]), Math.min(acc[0][1], p[1])],
        [Math.max(acc[1][0], p[0]), Math.max(acc[1][1], p[1])],
      ],
      [[points[0][0], points[0][1]], [points[0][0], points[0][1]]],
    );
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, points]);
  return null;
}

export default function MapPicker({ subject, candidates, initialSelectedUrls, onEstimateChange, onSelectionChange }: MapPickerProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectedUrls));
  const [estimate, setEstimate] = useState<CompsEstimate | null>(null);

  // Notify parent of selection changes (debounced via React's natural batching).
  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const center: [number, number] = useMemo(() => {
    if (subject.latitude != null && subject.longitude != null) return [subject.latitude, subject.longitude];
    const geo = candidates.filter((c) => c.latitude != null && c.longitude != null);
    if (geo.length === 0) return [37.52, -122.29];
    const lat = geo.reduce((s, c) => s + (c.latitude ?? 0), 0) / geo.length;
    const lng = geo.reduce((s, c) => s + (c.longitude ?? 0), 0) / geo.length;
    return [lat, lng];
  }, [subject, candidates]);

  const points: [number, number][] = useMemo(() => {
    const pts: [number, number][] = [];
    if (subject.latitude != null && subject.longitude != null) pts.push([subject.latitude, subject.longitude]);
    for (const c of candidates) if (c.latitude != null && c.longitude != null) pts.push([c.latitude, c.longitude]);
    return pts;
  }, [subject, candidates]);

  // Recompute distance from the same lat/lng pair we plot on the map — guarantees the number
  // shown matches what's on screen, ignoring any stale value baked into the candidate row.
  const subjectLatLng = useMemo(
    () => (subject.latitude != null && subject.longitude != null ? { lat: subject.latitude, lng: subject.longitude } : null),
    [subject.latitude, subject.longitude],
  );
  const distanceFor = (c: CompHomeWithGeo): number | null =>
    haversineMiles(
      subjectLatLng,
      c.latitude != null && c.longitude != null ? { lat: c.latitude, lng: c.longitude } : null,
    );

  const sortedCandidates = useMemo(
    () => [...candidates].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)),
    [candidates],
  );

  const toggle = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectTopK = (k: number) => {
    setSelected(new Set(sortedCandidates.slice(0, k).map((c) => c.redfin_url).filter(Boolean) as string[]));
  };

  // Recompute estimate whenever selection changes (debounced).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const picked = candidates.filter((c) => c.redfin_url && selected.has(c.redfin_url));
      if (picked.length === 0) {
        setEstimate(null);
        onEstimateChange?.(null);
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/admin/comps/recompute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subjectSqft: subject.sqft,
            subjectLotSqft: subject.lot_sqft ?? null,
            comps: picked.map((c) => ({
              sold_price: c.sold_price,
              sqft: c.sqft,
              similarity_score: c.total_score ?? c.similarity_score ?? 0.5,
              lot_sqft: c.lot_sqft,
            })),
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { estimate: CompsEstimate };
        setEstimate(json.estimate);
        onEstimateChange?.(json.estimate);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "recompute failed");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selected, candidates, subject.sqft, subject.lot_sqft, onEstimateChange]);

  return (
    <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
      <style jsx global>{`
        .leaflet-tooltip.comp-preview-tooltip {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 12px;
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
          white-space: normal;
          max-width: 300px;
        }
        .leaflet-tooltip.comp-preview-tooltip:before {
          border-top-color: white;
        }
      `}</style>
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-semibold text-sm">Comp picker</div>
          <div className="text-xs text-gray-600">
            {selected.size} of {candidates.length} selected · hover a pin to preview · click to toggle
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-3 text-gray-600 mr-2">
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-700 inline-block" /> Subject
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-green-700 inline-block" /> Included
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-gray-200 border-2 border-gray-500 inline-block" /> Excluded
            </span>
          </div>
          <button
            type="button"
            onClick={() => selectTopK(8)}
            className="px-2 py-1 border rounded hover:bg-gray-100"
          >
            Reset to top 8
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 border rounded hover:bg-gray-100"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-px bg-gray-200">
        <div className="bg-white max-h-[520px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 w-8">✓</th>
                <th className="px-2 py-2">Address</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">$/sf</th>
                <th className="px-2 py-2 text-right">Score</th>
                <th className="px-2 py-2 text-right">Dist</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => {
                const isSelected = c.redfin_url ? selected.has(c.redfin_url) : false;
                return (
                  <tr
                    key={c.redfin_url || c.address}
                    className={`border-t cursor-pointer ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}
                    onClick={() => c.redfin_url && toggle(c.redfin_url)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => c.redfin_url && toggle(c.redfin_url)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-2 py-2 truncate max-w-[200px]">
                      <div className="font-medium">{c.address.split(",")[0]}</div>
                      <div className="text-gray-500">{c.city ?? c.address.split(",")[1]?.trim()}</div>
                    </td>
                    <td className="px-2 py-2 text-right">{formatMoney(c.sold_price)}</td>
                    <td className="px-2 py-2 text-right">${Math.round(c.price_per_sqft)}</td>
                    <td className="px-2 py-2 text-right">{(c.total_score ?? c.similarity_score ?? 0).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right">{(() => { const d = distanceFor(c); return d != null ? `${d.toFixed(1)}mi` : "—"; })()}</td>
                  </tr>
                );
              })}
              {sortedCandidates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No candidates
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-white" style={{ height: 520 }}>
          <MapContainer
            center={center}
            zoom={14}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds points={points} />
            {subject.latitude != null && subject.longitude != null && (
              <CircleMarker
                center={[subject.latitude, subject.longitude]}
                radius={9}
                pathOptions={{ color: "#1d4ed8", fillColor: "#3b82f6", fillOpacity: 1, weight: 2 }}
              >
                <Tooltip permanent direction="top" offset={[0, -10]}>
                  <strong>Subject</strong>
                  <br />
                  {subject.address.split(",")[0]}
                </Tooltip>
              </CircleMarker>
            )}
            {sortedCandidates.map((c) => {
              if (c.latitude == null || c.longitude == null) return null;
              const isSelected = c.redfin_url ? selected.has(c.redfin_url) : false;
              return (
                <CircleMarker
                  key={c.redfin_url || c.address}
                  center={[c.latitude, c.longitude]}
                  radius={isSelected ? 11 : 8}
                  pathOptions={{
                    color: isSelected ? "#15803d" : "#6b7280",
                    fillColor: isSelected ? "#22c55e" : "#e5e7eb",
                    fillOpacity: isSelected ? 0.95 : 0.75,
                    weight: isSelected ? 2.5 : 1.5,
                  }}
                  eventHandlers={{ click: () => c.redfin_url && toggle(c.redfin_url) }}
                >
                  <Tooltip direction="top" offset={[0, -8]} opacity={1} className="comp-preview-tooltip">
                    <CompPreviewCard c={c} isSelected={isSelected} computedDistance={distanceFor(c)} />
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      <div className="px-4 py-3 border-t bg-gray-50 text-sm">
        {err && <div className="text-red-600 mb-2">Recompute failed: {err}</div>}
        {loading ? (
          <div className="text-gray-500">Recomputing…</div>
        ) : estimate ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <div>
              <span className="text-gray-500">Estimate: </span>
              <span className="font-semibold">{formatMoney(estimate.comp_based)}</span>
            </div>
            <div>
              <span className="text-gray-500">$/sqft: </span>
              <span className="font-semibold">${estimate.weighted_price_per_sqft.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500">Most likely: </span>
              <span className="font-semibold">
                {formatMoney(estimate.range.most_likely[0])}–{formatMoney(estimate.range.most_likely[1])}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Selected: </span>
              <span className="font-semibold">{selected.size}</span>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Pick at least one comp to compute an estimate.</div>
        )}
      </div>
    </div>
  );
}
