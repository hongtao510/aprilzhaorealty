"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { CompsResult, CompHomeWithGeo } from "@/lib/types";

// Leaflet uses window — load only on the client.
const MapPicker = dynamic(() => import("@/components/comps/MapPicker"), { ssr: false });

interface CandidatesResponse {
  candidates: CompHomeWithGeo[];
  subject: {
    address: string;
    sqft: number;
    beds: number;
    baths: number;
    lot_sqft: number;
    latitude: number | null;
    longitude: number | null;
    city: string | null;
  };
  scrape_source: string;
  enrichment: { attempted: number; fetched: number; ms: number };
  monthly_drift_pct: number;
}

const MODELS = [
  { value: "claude-opus-4-7", label: "Opus 4.7 (Latest)" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 (Balanced)" },
  { value: "claude-opus-4-6", label: "Opus 4.6 (Best)" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (Fast)" },
];

function formatMoney(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatFullPrice(n: number): string {
  return `$${n.toLocaleString()}`;
}

function timestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export default function CompsPage() {
  const { id } = useParams<{ id: string }>();
  const [model, setModel] = useState("claude-opus-4-7");
  const [logs, setLogs] = useState<{ time: string; message: string }[]>([]);
  const [rawOutput, setRawOutput] = useState("");
  const [result, setResult] = useState<CompsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState(false);
  const [editBeds, setEditBeds] = useState("");
  const [editBaths, setEditBaths] = useState("");
  const [editSqft, setEditSqft] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Two-phase flow: candidates first, then user-curated AI analysis.
  const [candidatesData, setCandidatesData] = useState<CandidatesResponse | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => new Set());

  const abortRef = useRef<AbortController | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef<HTMLPreElement>(null);

  const addLog = useCallback((message: string) => {
    setLogs((prev) => [...prev, { time: timestamp(), message }]);
  }, []);

  // Auto-scroll console and raw output
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (rawRef.current) {
      rawRef.current.scrollTop = rawRef.current.scrollHeight;
    }
  }, [rawOutput]);

  const handleSaveSubject = async () => {
    setSavingSubject(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/admin/candidate-homes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beds: editBeds ? parseInt(editBeds, 10) : null,
          baths: editBaths ? parseFloat(editBaths) : null,
          sqft: editSqft ? parseInt(editSqft, 10) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSaveMsg({ type: "err", text: data.error || "Failed to save" });
        return;
      }
      setEditingSubject(false);
      setSaveMsg({ type: "ok", text: "Saved! Re-running CMA..." });
      // Re-run comps with force refresh
      fetchComps(true);
    } catch {
      setSaveMsg({ type: "err", text: "Failed to save" });
    } finally {
      setSavingSubject(false);
    }
  };

  const fetchCandidates = useCallback(async () => {
    setCandidatesLoading(true);
    setCandidatesError(null);
    setCandidatesData(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/admin/candidate-homes/${id}/comps?mode=candidates`,
        { method: "POST" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as CandidatesResponse;
      setCandidatesData(data);
      // Pre-select only the 3 closest comps to the subject so the admin reviews and decides
      // which of the remaining 9 candidates to add.
      const sLat = data.subject.latitude;
      const sLng = data.subject.longitude;
      const haversine = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const R = 3958.7613, toRad = (d: number) => (d * Math.PI) / 180;
        const dLat = toRad(b.lat - a.lat);
        const dLng = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
      };
      const ranked =
        sLat != null && sLng != null
          ? [...data.candidates]
              .filter((c) => c.latitude != null && c.longitude != null)
              .map((c) => ({ url: c.redfin_url ?? "", d: haversine({ lat: sLat, lng: sLng }, { lat: c.latitude!, lng: c.longitude! }) }))
              .filter((x) => x.url)
              .sort((a, b) => a.d - b.d)
              .slice(0, 3)
              .map((x) => x.url)
          : [...data.candidates]
              .sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0))
              .slice(0, 3)
              .map((c) => c.redfin_url ?? "")
              .filter(Boolean);
      setSelectedUrls(new Set(ranked));
    } catch (err) {
      setCandidatesError(err instanceof Error ? err.message : "Failed to load candidates");
    } finally {
      setCandidatesLoading(false);
    }
  }, [id]);

  const fetchComps = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      setResult(null);
      setLogs([]);
      setRawOutput("");

      const controller = new AbortController();
      abortRef.current = controller;

      addLog("Starting CMA analysis...");
      addLog(`Model: ${MODELS.find((m) => m.value === model)?.label || model}`);
      if (selectedUrls.size > 0) {
        addLog(`Using ${selectedUrls.size} comps you picked on the map`);
      }

      try {
        const params = new URLSearchParams({ model, stream: "true" });
        if (force) params.set("force", "true");
        if (selectedUrls.size > 0) {
          params.set("selectedUrls", Array.from(selectedUrls).join(","));
        }

        const res = await fetch(`/api/admin/candidate-homes/${id}/comps?${params}`, {
          method: "POST",
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);
                if (eventType === "log") {
                  addLog(parsed.message);
                } else if (eventType === "token") {
                  setRawOutput((prev) => prev + parsed.text);
                } else if (eventType === "result") {
                  setResult(parsed as CompsResult);
                } else if (eventType === "error") {
                  setError(parsed.message);
                  addLog(`ERROR: ${parsed.message}`);
                }
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          addLog("Analysis stopped by user");
        } else {
          const msg = err instanceof Error ? err.message : "Unknown error";
          setError(msg);
          addLog(`ERROR: ${msg}`);
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [id, model, addLog, selectedUrls]
  );

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      addLog("Stopping...");
    }
  };

  // Auto-load candidates on mount; analysis only runs when admin clicks "Run AI Analysis".
  useEffect(() => {
    fetchCandidates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = result;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">Comparative Market Analysis</p>
          <h1 className="font-serif text-3xl text-neutral-900">
            {candidatesData?.subject?.address || result?.subject?.address || "Find Comps"}
          </h1>
          {(candidatesData?.subject || result?.subject) && (
            <p className="text-sm text-neutral-500 mt-1">
              {(candidatesData?.subject?.beds ?? result?.subject?.beds)} bd ·{" "}
              {(candidatesData?.subject?.baths ?? result?.subject?.baths)} ba ·{" "}
              {(candidatesData?.subject?.sqft ?? result?.subject?.sqft)?.toLocaleString()} sqft
              {(candidatesData?.subject?.lot_sqft ?? result?.subject?.lot_sqft)
                ? ` · lot ${(candidatesData?.subject?.lot_sqft ?? result?.subject?.lot_sqft)?.toLocaleString()} sqft`
                : ""}
            </p>
          )}
          <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="text-xs uppercase tracking-wider text-neutral-600 bg-transparent border border-neutral-200 rounded px-2 py-2 focus:outline-none focus:border-[#d4a012] cursor-pointer disabled:opacity-50"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {loading ? (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs uppercase tracking-wider hover:bg-red-700 transition-colors rounded"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
              Stop
            </button>
          ) : (
            <>
              <button
                onClick={() => fetchCandidates()}
                disabled={candidatesLoading}
                className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 text-neutral-700 text-xs uppercase tracking-wider hover:bg-neutral-100 transition-colors rounded disabled:opacity-50"
                title="Re-scrape and re-score nearby candidates"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Candidates
              </button>
              <button
                onClick={() => fetchComps(true)}
                disabled={candidatesLoading || selectedUrls.size === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-wider hover:bg-neutral-700 transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title={selectedUrls.size === 0 ? "Pick at least one comp first" : `Analyze with Claude using ${selectedUrls.size} comps`}
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run AI Analysis ({selectedUrls.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Console Output */}
      <div className="mb-8">
        <div className="bg-neutral-900 rounded-t-lg px-4 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="text-xs text-neutral-400 ml-2 font-mono">CMA Analysis Log</span>
          {loading && (
            <div className="ml-auto flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-green-400 font-mono">running</span>
            </div>
          )}
        </div>
        <div
          ref={consoleRef}
          className="bg-neutral-950 rounded-b-lg p-4 font-mono text-sm max-h-[300px] overflow-y-auto"
        >
          {logs.length === 0 && !loading && (
            <p className="text-neutral-600">No logs yet.</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-3 leading-relaxed">
              <span className="text-neutral-600 shrink-0 select-none">{log.time}</span>
              <span
                className={
                  log.message.startsWith("ERROR")
                    ? "text-red-400"
                    : log.message.startsWith("Warning")
                      ? "text-yellow-400"
                      : log.message === "Done!"
                        ? "text-green-400 font-bold"
                        : log.message.startsWith("Comp-based") || log.message.startsWith("Trend-adjusted")
                          ? "text-[#d4a012]"
                          : "text-neutral-300"
                }
              >
                {log.message || "\u00A0"}
              </span>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 leading-relaxed">
              <span className="text-neutral-600 shrink-0">{timestamp()}</span>
              <span className="text-neutral-500 animate-pulse">▌</span>
            </div>
          )}
        </div>
      </div>

      {/* Raw Claude Output — always visible while loading or if there's output */}
      {(loading || rawOutput) && (
        <div className="mb-8">
          <div className="bg-neutral-800 rounded-t-lg px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-neutral-400 font-mono">Claude Raw Output</span>
            <span className="text-xs text-neutral-500 font-mono">
              {rawOutput ? `${rawOutput.length.toLocaleString()} chars` : "waiting for response..."}
            </span>
          </div>
          <pre
            ref={rawRef}
            className="bg-neutral-900 rounded-b-lg p-4 font-mono text-xs text-green-400 max-h-[400px] overflow-y-auto whitespace-pre-wrap break-all leading-relaxed min-h-[100px]"
          >
            {rawOutput || (loading && <span className="text-neutral-600">Connecting to Claude API...</span>)}
            {loading && <span className="animate-pulse text-green-300">▌</span>}
          </pre>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-8 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => fetchComps(true)}
            className="text-xs uppercase tracking-wider text-red-700 hover:text-red-900 border border-red-300 rounded px-3 py-1 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      {/* Phase 1: candidate picker — always shown once candidates load */}
      {candidatesLoading && (
        <div className="mb-8 px-4 py-6 border border-neutral-200 rounded text-sm text-neutral-600">
          Loading nearby candidates…
        </div>
      )}
      {candidatesError && (
        <div className="mb-8 px-4 py-3 border border-red-300 bg-red-50 rounded text-sm text-red-700">
          Failed to load candidates: {candidatesError}
        </div>
      )}
      {candidatesData && candidatesData.candidates.length > 0 && (
        <section className="mb-10">
          <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">
            Step 1 — Pick comps to include ({candidatesData.candidates.length} nearby)
          </h3>
          <MapPicker
            subject={{
              ...candidatesData.subject,
              beds: candidatesData.subject.beds,
              baths: candidatesData.subject.baths,
              year_built: (candidatesData.subject as { year_built?: number | null }).year_built ?? null,
            }}
            candidates={candidatesData.candidates}
            initialSelectedUrls={Array.from(selectedUrls)}
            onSelectionChange={setSelectedUrls}
          />
          <p className="mt-3 text-xs text-neutral-500">
            Toggle pins or rows to refine. The estimate above the AI report uses your final selection.
            When you&apos;re happy, click <span className="font-semibold">Run AI Analysis</span> in the top right.
          </p>
        </section>
      )}

      {/* CMA Report */}
      {r && !loading && (
        <div className="space-y-8">
          {/* Subject Property — editable */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012]">Subject Property</h3>
              {!editingSubject ? (
                <button
                  onClick={() => {
                    setEditBeds(String(r.subject.beds ?? ""));
                    setEditBaths(String(r.subject.baths ?? ""));
                    setEditSqft(String(r.subject.sqft ?? ""));
                    setEditingSubject(true);
                    setSaveMsg(null);
                  }}
                  className="text-xs text-neutral-400 hover:text-[#d4a012] transition-colors uppercase tracking-wider"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {saveMsg && <span className={`text-xs ${saveMsg.type === "ok" ? "text-green-600" : "text-red-500"}`}>{saveMsg.text}</span>}
                  <button
                    onClick={() => { setEditingSubject(false); setSaveMsg(null); }}
                    className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors uppercase tracking-wider"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSubject}
                    disabled={savingSubject}
                    className="text-xs text-[#d4a012] hover:text-[#b8890f] transition-colors uppercase tracking-wider disabled:opacity-50"
                  >
                    {savingSubject ? "Saving..." : "Save & Re-run"}
                  </button>
                </div>
              )}
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
              <p className="font-serif text-lg text-neutral-900">{r.subject.address}</p>
              {editingSubject ? (
                <div className="flex gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Beds</label>
                    <input type="number" value={editBeds} onChange={(e) => setEditBeds(e.target.value)} className="w-20 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-[#d4a012]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Baths</label>
                    <input type="number" step="0.5" value={editBaths} onChange={(e) => setEditBaths(e.target.value)} className="w-20 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-[#d4a012]" />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Sqft</label>
                    <input type="number" value={editSqft} onChange={(e) => setEditSqft(e.target.value)} className="w-24 border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 focus:outline-none focus:border-[#d4a012]" />
                  </div>
                </div>
              ) : (
                <div className="flex gap-6 mt-2 text-sm text-neutral-600">
                  <span>{r.subject.sqft?.toLocaleString()} sqft</span>
                  <span>{r.subject.beds} bd / {r.subject.baths} ba</span>
                  {r.subject.lot_sqft && <span>{r.subject.lot_sqft.toLocaleString()} sqft lot</span>}
                </div>
              )}
            </div>
          </section>

          {/* Price Estimate */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Price Estimate</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Comp-Based</p>
                <p className="font-serif text-2xl text-neutral-900">{formatFullPrice(r.estimate.comp_based)}</p>
                <p className="text-xs text-neutral-400 mt-1">{formatFullPrice(r.estimate.weighted_price_per_sqft)}/sqft</p>
              </div>
              <div className="bg-[#d4a012]/5 border border-[#d4a012]/30 rounded p-4 text-center">
                <p className="text-xs text-[#d4a012] uppercase tracking-wider mb-1">Trend-Adjusted</p>
                <p className="font-serif text-2xl text-neutral-900">{formatFullPrice(r.estimate.trend_adjusted)}</p>
                <p className="text-xs text-neutral-400 mt-1">
                  {r.estimate.trend_adjustment_pct >= 0 ? "+" : ""}{r.estimate.trend_adjustment_pct}% adjustment
                </p>
              </div>
              <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
                <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Market</p>
                <p className={`font-serif text-2xl capitalize ${
                  r.estimate.market_temperature === "hot" ? "text-red-600" : r.estimate.market_temperature === "warm" ? "text-amber-600" : "text-blue-600"
                }`}>{r.estimate.market_temperature}</p>
                <p className="text-xs text-neutral-400 mt-1">MoM: {r.market_signals.mom_change}</p>
              </div>
            </div>
          </section>

          {/* Price Range */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Price Range</h3>
            <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
              <PriceRangeBar estimate={r.estimate} />
            </div>

            <table className="w-full mt-4 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 border-b">
                  <th className="pb-2">Likelihood</th>
                  <th className="pb-2">Range</th>
                  <th className="pb-2 text-right">Chance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                <tr>
                  <td className="py-2 text-[#d4a012]">★★★★★ Most likely</td>
                  <td className="py-2">{formatFullPrice(r.estimate.range.most_likely[0])} – {formatFullPrice(r.estimate.range.most_likely[1])}</td>
                  <td className="py-2 text-right font-medium">50%</td>
                </tr>
                <tr>
                  <td className="py-2 text-[#d4a012]/70">★★★★ Likely</td>
                  <td className="py-2">{formatFullPrice(r.estimate.range.likely[0])} – {formatFullPrice(r.estimate.range.likely[1])}</td>
                  <td className="py-2 text-right font-medium">25%</td>
                </tr>
                <tr>
                  <td className="py-2 text-neutral-400">★★★ Possible</td>
                  <td className="py-2">{formatFullPrice(r.estimate.range.possible[0])} – {formatFullPrice(r.estimate.range.possible[1])}</td>
                  <td className="py-2 text-right font-medium">15%</td>
                </tr>
                <tr>
                  <td className="py-2 text-neutral-300">★★ Unlikely</td>
                  <td className="py-2">Below {formatFullPrice(r.estimate.range.unlikely_below)} or above {formatFullPrice(r.estimate.range.unlikely_above)}</td>
                  <td className="py-2 text-right font-medium">10%</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Market Signals */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Market Signals</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Sale-to-List", value: r.market_signals.sale_to_list_ratio },
                { label: "Days on Market", value: `${r.market_signals.days_on_market}` },
                { label: "YoY Change", value: r.market_signals.yoy_change },
                { label: "MoM Change", value: r.market_signals.mom_change },
              ].map((s) => (
                <div key={s.label} className="bg-neutral-50 border border-neutral-200 rounded p-3 text-center">
                  <p className="text-xs text-neutral-500 mb-1">{s.label}</p>
                  <p className="font-medium text-neutral-900">{s.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Comps Table */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Top {r.comps.length} Comparable Sales</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-neutral-500 border-b">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Address</th>
                    <th className="pb-2 pr-3 text-right">Sold Price</th>
                    <th className="pb-2 pr-3">Date</th>
                    <th className="pb-2 pr-3 text-right">Sqft</th>
                    <th className="pb-2 pr-3">Bed/Bath</th>
                    <th className="pb-2 pr-3 text-right">$/Sqft</th>
                    <th className="pb-2 pr-3 text-right">Score</th>
                    <th className="pb-2">Source</th>
                    <th className="pb-2 text-right">Distance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {r.comps.map((comp, i) => (
                    <tr key={i} className="hover:bg-neutral-50">
                      <td className="py-2 pr-3 text-neutral-400">{i + 1}</td>
                      <td className="py-2 pr-3 text-neutral-900">{comp.address}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatFullPrice(comp.sold_price)}</td>
                      <td className="py-2 pr-3 text-neutral-500">{comp.sold_date}</td>
                      <td className="py-2 pr-3 text-right">{comp.sqft.toLocaleString()}</td>
                      <td className="py-2 pr-3">{comp.beds}/{comp.baths}</td>
                      <td className="py-2 pr-3 text-right">${comp.price_per_sqft}</td>
                      <td className="py-2 pr-3 text-right">
                        <span className="inline-block px-2 py-0.5 text-xs rounded bg-[#d4a012]/10 text-[#d4a012] font-medium">
                          {Math.round(comp.similarity_score * 100)}%
                        </span>
                      </td>
                      <td className="py-2">
                        {comp.redfin_url ? (
                          <a href={comp.redfin_url} target="_blank" rel="noopener noreferrer" className="text-[#d4a012] hover:text-[#b8890f] text-xs underline">
                            Redfin
                          </a>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-xs text-neutral-400">
                        {comp.distance_miles ? `${comp.distance_miles.toFixed(1)} mi` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Why Selected */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Why Each Was Selected</h3>
            <div className="space-y-2">
              {r.comps.map((comp, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <span className="text-neutral-400 shrink-0">{i + 1}.</span>
                  <div>
                    <span className="font-medium text-neutral-900">{comp.address}</span>
                    <span className="text-neutral-500"> — {comp.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Analysis */}
          <section>
            <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Analysis</h3>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.reasoning}</p>
          </section>
        </div>
      )}
    </div>
  );
}

/* ---------- Price Range Bar ---------- */

function PriceRangeBar({ estimate }: { estimate: CompsResult["estimate"] }) {
  const { range, trend_adjusted } = estimate;
  const min = range.unlikely_below;
  const max = range.unlikely_above;
  const span = max - min;
  if (span <= 0) return null;

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));

  return (
    <div>
      <div className="relative h-8 flex items-center">
        <div className="absolute inset-x-0 h-3 bg-neutral-200 rounded-full">
          {/* Possible */}
          <div className="absolute h-full bg-neutral-300 rounded-full" style={{
            left: `${pct(range.possible[0])}%`,
            width: `${pct(range.possible[1]) - pct(range.possible[0])}%`,
          }} />
          {/* Likely */}
          <div className="absolute h-full bg-[#d4a012]/40 rounded-full" style={{
            left: `${pct(range.likely[0])}%`,
            width: `${pct(range.likely[1]) - pct(range.likely[0])}%`,
          }} />
          {/* Most likely */}
          <div className="absolute h-full bg-[#d4a012] rounded-full" style={{
            left: `${pct(range.most_likely[0])}%`,
            width: `${pct(range.most_likely[1]) - pct(range.most_likely[0])}%`,
          }} />
        </div>
        {/* Estimate marker */}
        <div className="absolute z-10" style={{ left: `${pct(trend_adjusted)}%` }}>
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-neutral-900 -translate-x-1/2 -translate-y-1" />
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
        <span>{formatMoney(min)}</span>
        <span>{formatMoney(trend_adjusted)} est.</span>
        <span>{formatMoney(max)}</span>
      </div>
    </div>
  );
}
