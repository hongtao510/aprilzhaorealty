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
  subject: { address: string; sqft: number; lot_sqft: number; latitude?: number | null; longitude?: number | null; beds?: number; baths?: number; year_built?: number | null };
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
  const [manualComps, setManualComps] = useState<CompHomeWithGeo[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    address: "",
    sold_price: "",
    sold_date: "",
    sqft: "",
    beds: "",
    baths: "",
    lot_sqft: "",
    latitude: "",
    longitude: "",
  });

  // Notify parent of selection changes (debounced via React's natural batching).
  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);

  // Merge scraped + manual comps into a single working list.
  const allCandidates = useMemo<CompHomeWithGeo[]>(() => [...candidates, ...manualComps], [candidates, manualComps]);

  // Subject specs used for the spec-mismatch highlighting in the picker rows.
  const subjectSpecs = {
    bd: subject.beds ?? 0,
    ba: subject.baths ?? 0,
    sqft: subject.sqft ?? 0,
    year: subject.year_built ?? null,
  };
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
    for (const c of [...candidates, ...manualComps])
      if (c.latitude != null && c.longitude != null) pts.push([c.latitude, c.longitude]);
    return pts;
  }, [subject, candidates, manualComps]);

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

  type SortKey = "selected" | "address" | "specs" | "price" | "ppsf" | "score" | "distance";
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      // Sensible default direction per column.
      setSortDir(k === "address" || k === "distance" ? "asc" : "desc");
    }
  };

  const sortIndicator = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const sortedCandidates = useMemo(() => {
    const list = [...allCandidates];
    const sign = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      switch (sortKey) {
        case "selected":
          av = a.redfin_url && selected.has(a.redfin_url) ? 1 : 0;
          bv = b.redfin_url && selected.has(b.redfin_url) ? 1 : 0;
          break;
        case "address":
          av = (a.address.split(",")[0] || "").toLowerCase();
          bv = (b.address.split(",")[0] || "").toLowerCase();
          break;
        case "specs":
          // Sort by sqft as the dominant comp similarity signal.
          av = a.sqft; bv = b.sqft; break;
        case "price":
          av = a.sold_price; bv = b.sold_price; break;
        case "ppsf":
          av = a.price_per_sqft; bv = b.price_per_sqft; break;
        case "score":
          av = a.total_score ?? a.similarity_score ?? 0;
          bv = b.total_score ?? b.similarity_score ?? 0;
          break;
        case "distance":
          av = distanceFor(a) ?? Infinity;
          bv = distanceFor(b) ?? Infinity;
          break;
      }
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCandidates, sortKey, sortDir, selected, subject.latitude, subject.longitude]);

  const closestN = useMemo(
    () =>
      [...allCandidates]
        .map((c) => ({ c, d: distanceFor(c) }))
        .filter((x) => x.d != null)
        .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allCandidates, subject.latitude, subject.longitude],
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

  const selectClosestN = (n: number) => {
    setSelected(new Set(closestN.slice(0, n).map((x) => x.c.redfin_url).filter(Boolean) as string[]));
  };

  const addManualComp = () => {
    const sold_price = parseFloat(manualForm.sold_price.replace(/[^0-9.]/g, ""));
    const sqft = parseFloat(manualForm.sqft.replace(/[^0-9.]/g, ""));
    if (!manualForm.address || !sold_price || !sqft) return;
    const lat = parseFloat(manualForm.latitude);
    const lng = parseFloat(manualForm.longitude);
    const lot = parseFloat(manualForm.lot_sqft.replace(/[^0-9.]/g, ""));
    const url = `manual-${Date.now()}`;
    const newComp: CompHomeWithGeo = {
      address: manualForm.address,
      sold_price,
      sold_date: manualForm.sold_date || "",
      sqft,
      beds: parseFloat(manualForm.beds) || 0,
      baths: parseFloat(manualForm.baths) || 0,
      lot_sqft: Number.isFinite(lot) ? lot : 0,
      similarity_score: 0.7,
      total_score: 0.7,
      price_per_sqft: sold_price / sqft,
      reason: "Manually added",
      redfin_url: url,
      distance_miles: 0,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      city: null,
    };
    setManualComps((prev) => [...prev, newComp]);
    setSelected((prev) => new Set([...prev, url]));
    setManualForm({
      address: "", sold_price: "", sold_date: "", sqft: "", beds: "", baths: "", lot_sqft: "", latitude: "", longitude: "",
    });
    setManualOpen(false);
  };

  // Recompute estimate whenever selection changes (debounced).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const picked = allCandidates.filter((c) => c.redfin_url && selected.has(c.redfin_url));
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
  }, [selected, allCandidates, subject.sqft, subject.lot_sqft, onEstimateChange]);

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
        .leaflet-tooltip.comp-subject-tooltip {
          background: white;
          border: 2px solid #dc2626;
          border-radius: 6px;
          padding: 4px 8px;
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
          font-size: 12px;
          white-space: normal;
        }
        .leaflet-tooltip.comp-subject-tooltip:before {
          border-top-color: #dc2626;
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
              <span className="w-3 h-3 rounded-full bg-red-600 border-2 border-red-800 inline-block" /> Target home
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
            onClick={() => selectClosestN(3)}
            className="px-2 py-1 border rounded hover:bg-gray-100"
          >
            Pre-pick 3 closest
          </button>
          <button
            type="button"
            onClick={() => selectTopK(8)}
            className="px-2 py-1 border rounded hover:bg-gray-100"
          >
            Top 8 by score
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="px-2 py-1 border rounded hover:bg-gray-100"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="px-2 py-1 border border-blue-300 bg-blue-50 text-blue-800 rounded hover:bg-blue-100"
          >
            + Add manual comp
          </button>
        </div>
      </div>

      {manualOpen && (
        <div className="px-4 py-3 border-b bg-blue-50/40">
          <div className="text-xs font-semibold text-blue-900 mb-2">Add a comp the algorithm missed</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <input className="border rounded px-2 py-1 col-span-2 md:col-span-2" placeholder="Address" value={manualForm.address} onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Sold price ($)" value={manualForm.sold_price} onChange={(e) => setManualForm({ ...manualForm, sold_price: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Sqft" value={manualForm.sqft} onChange={(e) => setManualForm({ ...manualForm, sqft: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Beds" value={manualForm.beds} onChange={(e) => setManualForm({ ...manualForm, beds: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Baths" value={manualForm.baths} onChange={(e) => setManualForm({ ...manualForm, baths: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Lot sqft (opt)" value={manualForm.lot_sqft} onChange={(e) => setManualForm({ ...manualForm, lot_sqft: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Sold date YYYY-MM-DD (opt)" value={manualForm.sold_date} onChange={(e) => setManualForm({ ...manualForm, sold_date: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Lat (opt — to plot on map)" value={manualForm.latitude} onChange={(e) => setManualForm({ ...manualForm, latitude: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Lng (opt)" value={manualForm.longitude} onChange={(e) => setManualForm({ ...manualForm, longitude: e.target.value })} />
            <button type="button" onClick={addManualComp} className="col-span-2 md:col-span-1 px-3 py-1 bg-blue-600 text-white rounded text-xs">Add</button>
            <button type="button" onClick={() => setManualOpen(false)} className="col-span-2 md:col-span-1 px-3 py-1 border rounded text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex flex-col bg-gray-200 gap-px">
        {/* MAP first (full-width, on top) */}
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
              <>
                <CircleMarker
                  center={[subject.latitude, subject.longitude]}
                  radius={20}
                  pathOptions={{
                    color: "#dc2626",
                    fillColor: "#dc2626",
                    fillOpacity: 0.12,
                    weight: 3,
                    dashArray: "4 4",
                  }}
                  interactive={false}
                />
                <CircleMarker
                  center={[subject.latitude, subject.longitude]}
                  radius={11}
                  pathOptions={{
                    color: "#991b1b",
                    fillColor: "#dc2626",
                    fillOpacity: 1,
                    weight: 3,
                  }}
                >
                  <Tooltip permanent direction="top" offset={[0, -12]} className="comp-subject-tooltip">
                    <strong style={{ color: "#dc2626" }}>★ Target Home</strong>
                    <br />
                    {subject.address.split(",")[0]}
                  </Tooltip>
                </CircleMarker>
              </>
            )}
            {sortedCandidates.map((c) => {
              if (c.latitude == null || c.longitude == null) return null;
              const isSelected = c.redfin_url ? selected.has(c.redfin_url) : false;
              const isManual = c.redfin_url?.startsWith("manual-");
              return (
                <CircleMarker
                  key={c.redfin_url || c.address}
                  center={[c.latitude, c.longitude]}
                  radius={isSelected ? 11 : 8}
                  pathOptions={{
                    color: isSelected ? (isManual ? "#1e40af" : "#15803d") : "#6b7280",
                    fillColor: isSelected ? (isManual ? "#3b82f6" : "#22c55e") : "#e5e7eb",
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

        {/* LIST below the map */}
        <div className="bg-white max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="text-left select-none">
                <th className="px-3 py-2 w-8 cursor-pointer hover:bg-gray-100" onClick={() => onSort("selected")} title="Sort by selection">✓{sortIndicator("selected")}</th>
                <th className="px-2 py-2 cursor-pointer hover:bg-gray-100" onClick={() => onSort("address")}>Address{sortIndicator("address")}</th>
                <th className="px-2 py-2 cursor-pointer hover:bg-gray-100" onClick={() => onSort("specs")}>Bd/Ba · Sqft · Yr{sortIndicator("specs")}</th>
                <th className="px-2 py-2 text-right cursor-pointer hover:bg-gray-100" onClick={() => onSort("price")}>Price{sortIndicator("price")}</th>
                <th className="px-2 py-2 text-right cursor-pointer hover:bg-gray-100" onClick={() => onSort("ppsf")}>$/sf{sortIndicator("ppsf")}</th>
                <th className="px-2 py-2 text-right cursor-pointer hover:bg-gray-100" onClick={() => onSort("score")}>Score{sortIndicator("score")}</th>
                <th className="px-2 py-2 text-right cursor-pointer hover:bg-gray-100" onClick={() => onSort("distance")}>Dist{sortIndicator("distance")}</th>
              </tr>
            </thead>
            <tbody>
              {/* Subject reference row — shown for at-a-glance comparison only */}
              <tr className="border-t bg-red-50/50">
                <td className="px-3 py-2 text-red-600">★</td>
                <td className="px-2 py-2 truncate max-w-[220px]">
                  <div className="font-semibold text-red-700">{subject.address.split(",")[0]}</div>
                  <div className="text-red-700/70 text-[10px] uppercase tracking-wider">Target home</div>
                </td>
                <td className="px-2 py-2 whitespace-nowrap text-red-700 font-medium">
                  {subject.beds ?? "?"}bd/{subject.baths ?? "?"}ba · {subject.sqft?.toLocaleString() || "?"}sf
                  {subject.year_built ? ` · ${subject.year_built}` : ""}
                </td>
                <td className="px-2 py-2 text-right text-gray-400">—</td>
                <td className="px-2 py-2 text-right text-gray-400">—</td>
                <td className="px-2 py-2 text-right text-gray-400">—</td>
                <td className="px-2 py-2 text-right text-gray-400">—</td>
              </tr>
              {sortedCandidates.map((c) => {
                const isSelected = c.redfin_url ? selected.has(c.redfin_url) : false;
                const isManual = c.redfin_url?.startsWith("manual-");
                return (
                  <tr
                    key={c.redfin_url || c.address}
                    className={`border-t cursor-pointer ${isSelected ? (isManual ? "bg-indigo-50" : "bg-blue-50") : "hover:bg-gray-50"}`}
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
                    <td className="px-2 py-2 truncate max-w-[220px]">
                      <div className="font-medium flex items-center gap-1">
                        {c.address.split(",")[0]}
                        {isManual && <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 bg-blue-100 text-blue-700 rounded">manual</span>}
                      </div>
                      <div className="text-gray-500">{c.city ?? c.address.split(",")[1]?.trim()}</div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={c.beds && c.baths && Math.abs(c.beds + c.baths - (subjectSpecs.bd + subjectSpecs.ba)) <= 1 ? "" : "text-amber-700"}>
                        {c.beds || "?"}bd/{c.baths || "?"}ba
                      </span>
                      <span className="text-gray-400"> · </span>
                      <span className={c.sqft && Math.abs(c.sqft - subjectSpecs.sqft) / Math.max(subjectSpecs.sqft, 1) <= 0.20 ? "" : "text-amber-700"}>
                        {c.sqft ? c.sqft.toLocaleString() : "?"}sf
                      </span>
                      {c.year_built && (
                        <>
                          <span className="text-gray-400"> · </span>
                          <span className={Math.abs(c.year_built - (subjectSpecs.year || c.year_built)) <= 20 ? "text-gray-500" : "text-amber-700"}>
                            {c.year_built}
                          </span>
                        </>
                      )}
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
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                    No candidates
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
