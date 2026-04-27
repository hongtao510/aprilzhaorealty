"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { CompHomeWithGeo, CompsEstimate } from "@/lib/types";

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
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold text-sm">Manual comp picker</div>
          <div className="text-xs text-gray-600">
            {selected.size} of {candidates.length} selected · click pins or rows to toggle
          </div>
        </div>
        <div className="flex gap-2 text-xs">
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
                    <td className="px-2 py-2 text-right">{(c.distance_miles ?? 0).toFixed(1)}mi</td>
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
                  radius={isSelected ? 8 : 6}
                  pathOptions={{
                    color: isSelected ? "#15803d" : "#9ca3af",
                    fillColor: isSelected ? "#22c55e" : "#d1d5db",
                    fillOpacity: 0.85,
                    weight: 2,
                  }}
                  eventHandlers={{ click: () => c.redfin_url && toggle(c.redfin_url) }}
                >
                  <Tooltip>
                    <div className="text-xs">
                      <strong>{c.address.split(",")[0]}</strong>
                      <br />
                      {formatMoney(c.sold_price)} · {c.sqft} sf · ${Math.round(c.price_per_sqft)}/sf
                      <br />
                      score {(c.total_score ?? c.similarity_score ?? 0).toFixed(2)}
                      {c.city ? ` · ${c.city}` : ""}
                    </div>
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
