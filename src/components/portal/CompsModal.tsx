"use client";

import { useState, useEffect, useCallback } from "react";
import type { CompsResult } from "@/lib/types";

interface CompsModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeAddress: string;
  homeId: string;
}

type ModelOption = {
  value: string;
  label: string;
};

const models: ModelOption[] = [
  { value: "claude-opus-4-6", label: "Opus 4.6 Best" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 Balanced" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 Fast" },
];

function formatMoney(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(0)}K`;
  }
  return `$${n.toLocaleString()}`;
}

function formatFullPrice(n: number): string {
  return `$${n.toLocaleString()}`;
}

export default function CompsModal({
  isOpen,
  onClose,
  homeAddress,
  homeId,
}: CompsModalProps) {
  const [model, setModel] = useState("claude-opus-4-6");
  const [result, setResult] = useState<CompsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchComps = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/candidate-homes/${homeId}/comps?model=${model}&force=${force}`,
          { method: "POST" }
        );
        if (!res.ok) {
          throw new Error(`Failed to fetch comps (${res.status})`);
        }
        const data = await res.json();
        setResult(data.comps ?? data);
        setHasFetched(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [homeId, model]
  );

  useEffect(() => {
    if (isOpen && !hasFetched && !loading) {
      fetchComps(false);
    }
  }, [isOpen, hasFetched, loading, fetchComps]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setResult(null);
      setHasFetched(false);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tempColor =
    result?.estimate.market_temperature === "hot"
      ? "text-red-600"
      : result?.estimate.market_temperature === "warm"
        ? "text-amber-600"
        : "text-blue-600";

  const tempLabel =
    result?.estimate.market_temperature === "hot"
      ? "Hot"
      : result?.estimate.market_temperature === "warm"
        ? "Warm"
        : "Cool";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-5xl max-h-[90vh] flex flex-col rounded shadow-2xl">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-serif text-xl text-neutral-900">CMA Report</h2>
            <p className="text-sm text-neutral-500 truncate">{homeAddress}</p>
          </div>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="text-xs uppercase tracking-wider text-neutral-600 bg-transparent border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#d4a012] cursor-pointer"
          >
            {models.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fetchComps(true)}
            disabled={loading}
            className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] border border-[#d4a012] rounded px-3 py-1.5 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-6 space-y-8">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <svg
                className="animate-spin h-8 w-8 text-[#d4a012] mb-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-sm text-neutral-500">Analyzing comparable sales...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center justify-between">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => fetchComps(true)}
                className="text-xs uppercase tracking-wider text-red-700 hover:text-red-900 border border-red-300 rounded px-3 py-1 transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              {/* 1. Subject Property */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Subject Property</h3>
                <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
                  <p className="font-serif text-lg text-neutral-900 mb-2">{result.subject.address}</p>
                  <div className="flex gap-6 text-sm text-neutral-600">
                    <span>{result.subject.sqft.toLocaleString()} sqft</span>
                    <span>{result.subject.beds} bed / {result.subject.baths} bath</span>
                    <span>{result.subject.lot_sqft.toLocaleString()} sqft lot</span>
                  </div>
                </div>
              </section>

              {/* 2. Price Estimate */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Price Estimate</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Comp-Based</p>
                    <p className="font-serif text-2xl text-neutral-900">{formatFullPrice(result.estimate.comp_based)}</p>
                  </div>
                  <div className="bg-[#d4a012]/10 border border-[#d4a012]/30 rounded p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-[#d4a012] mb-1">Trend-Adjusted</p>
                    <p className="font-serif text-2xl text-neutral-900">{formatFullPrice(result.estimate.trend_adjusted)}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {result.estimate.trend_adjustment_pct >= 0 ? "+" : ""}
                      {result.estimate.trend_adjustment_pct.toFixed(1)}% adjustment
                    </p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">Market Temp</p>
                    <p className={`font-serif text-2xl ${tempColor}`}>{tempLabel}</p>
                  </div>
                </div>
              </section>

              {/* 3. Price Range */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Price Range</h3>
                <PriceRangeChart estimate={result.estimate} />
              </section>

              {/* 4. Market Signals */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Market Signals</h3>
                <div className="grid grid-cols-4 gap-4">
                  <SignalCard label="Sale-to-List Ratio" value={result.market_signals.sale_to_list_ratio} />
                  <SignalCard label="Days on Market" value={`${result.market_signals.days_on_market}`} />
                  <SignalCard label="YoY Change" value={result.market_signals.yoy_change} />
                  <SignalCard label="MoM Change" value={result.market_signals.mom_change} />
                </div>
              </section>

              {/* 5. Top 8 Comparable Sales */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Top 8 Comparable Sales</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-[10px] uppercase tracking-wider text-neutral-400">
                        <th className="py-2 pr-2 text-left">#</th>
                        <th className="py-2 pr-2 text-left">Address</th>
                        <th className="py-2 pr-2 text-right">Sold Price</th>
                        <th className="py-2 pr-2 text-right">Date</th>
                        <th className="py-2 pr-2 text-right">Sqft</th>
                        <th className="py-2 pr-2 text-right">Bed/Bath</th>
                        <th className="py-2 pr-2 text-right">$/Sqft</th>
                        <th className="py-2 pl-2 text-right">Similarity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comps.slice(0, 8).map((comp, i) => (
                        <tr key={i} className="border-b border-neutral-100">
                          <td className="py-2 pr-2 text-neutral-400">{i + 1}</td>
                          <td className="py-2 pr-2 text-neutral-900">{comp.address}</td>
                          <td className="py-2 pr-2 text-right text-neutral-900">{formatFullPrice(comp.sold_price)}</td>
                          <td className="py-2 pr-2 text-right text-neutral-500">{comp.sold_date}</td>
                          <td className="py-2 pr-2 text-right text-neutral-500">{comp.sqft.toLocaleString()}</td>
                          <td className="py-2 pr-2 text-right text-neutral-500">{comp.beds}/{comp.baths}</td>
                          <td className="py-2 pr-2 text-right text-neutral-500">${comp.price_per_sqft.toFixed(0)}</td>
                          <td className="py-2 pl-2 text-right">
                            <span className="inline-block bg-[#d4a012]/10 text-[#d4a012] text-xs font-medium px-2 py-0.5 rounded">
                              {Math.round(comp.similarity_score * 100)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 6. Why Each Was Selected */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Why Each Was Selected</h3>
                <ol className="space-y-2">
                  {result.comps.slice(0, 8).map((comp, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="text-neutral-400 font-medium shrink-0">{i + 1}.</span>
                      <div>
                        <span className="text-neutral-900 font-medium">{comp.address}</span>
                        <span className="text-neutral-500"> — {comp.reason}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* 7. Analysis */}
              <section>
                <h3 className="text-[10px] uppercase tracking-wider text-neutral-400 mb-3">Analysis</h3>
                <p className="text-sm text-neutral-700 leading-relaxed">{result.reasoning}</p>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SignalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
      <p className="text-[10px] uppercase tracking-wider text-neutral-400 mb-1">{label}</p>
      <p className="font-serif text-xl text-neutral-900">{value}</p>
    </div>
  );
}

function PriceRangeChart({ estimate }: { estimate: CompsResult["estimate"] }) {
  const { range, trend_adjusted } = estimate;
  const min = range.possible[0];
  const max = range.possible[1];
  const span = max - min;

  const pct = (v: number) => ((v - min) / span) * 100;

  const bands = [
    { label: "Most Likely", low: range.most_likely[0], high: range.most_likely[1], color: "bg-[#d4a012]/50", stars: 5, chance: "50%" },
    { label: "Likely", low: range.likely[0], high: range.likely[1], color: "bg-[#d4a012]/20", stars: 4, chance: "25%" },
    { label: "Possible", low: range.possible[0], high: range.possible[1], color: "bg-neutral-200", stars: 3, chance: "15%" },
  ];

  const visualBands = [...bands].reverse(); // render possible first (widest) for z-order

  return (
    <div>
      {/* Visual bar */}
      <div className="relative h-12 mb-2">
        {visualBands.map((band) => (
          <div
            key={band.label}
            className={`absolute top-0 h-full rounded ${band.color}`}
            style={{
              left: `${pct(band.low)}%`,
              width: `${pct(band.high) - pct(band.low)}%`,
            }}
          />
        ))}
        {/* Estimate marker triangle */}
        <div
          className="absolute top-0 -translate-x-1/2"
          style={{ left: `${pct(trend_adjusted)}%` }}
        >
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[10px] border-t-[#d4a012]" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-neutral-500">
            {formatMoney(trend_adjusted)}
          </div>
        </div>
      </div>

      {/* Min / Max labels */}
      <div className="flex justify-between text-[10px] text-neutral-400 mb-4">
        <span>{formatMoney(min)}</span>
        <span>{formatMoney(max)}</span>
      </div>

      {/* Likelihood table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-[10px] uppercase tracking-wider text-neutral-400">
            <th className="py-1 text-left">Likelihood</th>
            <th className="py-1 text-left">Range</th>
            <th className="py-1 text-right">Chance</th>
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <tr key={band.label} className="border-b border-neutral-100">
              <td className="py-1.5 text-[#d4a012]">{"★".repeat(band.stars)} {band.label}</td>
              <td className="py-1.5 text-neutral-500">{formatFullPrice(band.low)} – {formatFullPrice(band.high)}</td>
              <td className="py-1.5 text-right font-medium text-neutral-700">{band.chance}</td>
            </tr>
          ))}
          <tr className="border-b border-neutral-100">
            <td className="py-1.5 text-neutral-300">★★ Unlikely</td>
            <td className="py-1.5 text-neutral-500">Below {formatFullPrice(range.unlikely_below)} or above {formatFullPrice(range.unlikely_above)}</td>
            <td className="py-1.5 text-right font-medium text-neutral-700">10%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
