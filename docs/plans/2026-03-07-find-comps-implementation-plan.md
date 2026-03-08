# Find Comps Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Find Comps" button to each candidate home card that calls Claude API to run a CMA, displaying results in a modal with top 8 comps, price estimate, and market analysis.

**Architecture:** Button on CandidateHomeCard triggers POST to `/api/admin/candidate-homes/[id]/comps`. API checks cache (Supabase `candidate_comps` table, 7-day expiry), calls Claude API if stale, returns structured JSON. CompsModal renders the CMA report with comps table, price distribution, and model selector.

**Tech Stack:** Next.js App Router, Supabase, Anthropic SDK (`@anthropic-ai/sdk`), TypeScript, Tailwind CSS

---

### Task 1: Create Supabase Migration for `candidate_comps` Table

**Files:**
- Create: `supabase-candidate-comps.sql`

**Step 1: Write the migration SQL**

```sql
-- ============================================
-- Candidate Comps Migration
-- Run this in the Supabase SQL Editor
-- Adds candidate_comps table for cached CMA results
-- ============================================

create table if not exists public.candidate_comps (
  id uuid primary key default gen_random_uuid(),
  candidate_home_id uuid references public.candidate_homes(id) on delete cascade,
  comps jsonb not null,
  price_estimate numeric,
  price_range_low numeric,
  price_range_high numeric,
  market_temperature text check (market_temperature in ('hot', 'warm', 'cool')),
  reasoning text,
  raw_response text,
  created_at timestamptz not null default now()
);

create index idx_candidate_comps_home_id on public.candidate_comps(candidate_home_id);

alter table public.candidate_comps enable row level security;

create policy "Admin can do anything with candidate_comps"
  on public.candidate_comps for all
  using (is_admin());
```

**Step 2: Run in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste and run. Verify table appears in Table Editor.

**Step 3: Commit**

```bash
git add supabase-candidate-comps.sql
git commit -m "feat: add candidate_comps table migration for CMA cache"
```

---

### Task 2: Add CompsResult Types

**Files:**
- Modify: `src/lib/types.ts` (append after `SearchCriteria` interface, line ~133)

**Step 1: Add the types**

Append to `src/lib/types.ts`:

```typescript
export interface CompHome {
  address: string;
  sold_price: number;
  sold_date: string;
  sqft: number;
  beds: number;
  baths: number;
  lot_sqft: number;
  similarity_score: number;
  price_per_sqft: number;
  reason: string;
}

export interface CompsEstimate {
  weighted_price_per_sqft: number;
  comp_based: number;
  trend_adjusted: number;
  market_temperature: "hot" | "warm" | "cool";
  trend_adjustment_pct: number;
  range: {
    most_likely: [number, number];
    likely: [number, number];
    possible: [number, number];
    unlikely_below: number;
    unlikely_above: number;
  };
}

export interface CompsMarketSignals {
  sale_to_list_ratio: string;
  days_on_market: number;
  yoy_change: string;
  mom_change: string;
}

export interface CompsResult {
  comps: CompHome[];
  subject: {
    address: string;
    sqft: number;
    beds: number;
    baths: number;
    lot_sqft: number;
  };
  estimate: CompsEstimate;
  market_signals: CompsMarketSignals;
  reasoning: string;
}

export interface CandidateComp {
  id: string;
  candidate_home_id: string;
  comps: CompsResult;
  price_estimate: number | null;
  price_range_low: number | null;
  price_range_high: number | null;
  market_temperature: "hot" | "warm" | "cool" | null;
  reasoning: string | null;
  raw_response: string | null;
  created_at: string;
}
```

**Step 2: Verify no type errors**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add CompsResult types for CMA feature"
```

---

### Task 3: Install Anthropic SDK

**Step 1: Install the package**

```bash
npm install @anthropic-ai/sdk
```

**Step 2: Add API key to `.env.local`**

Add this line to `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...your-key-here...
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @anthropic-ai/sdk for CMA feature"
```

---

### Task 4: Create Comps API Endpoint

**Files:**
- Create: `src/app/api/admin/candidate-homes/[id]/comps/route.ts`

**Step 1: Create the API route**

This is the core endpoint. It:
1. Verifies admin auth (same pattern as `candidate-homes/route.ts`)
2. Fetches the candidate home by ID
3. Checks cache in `candidate_comps` (7-day expiry)
4. If cache miss or `force=true`, calls Claude API with housing-comparisons skill prompt
5. Parses Claude's JSON response
6. Saves to `candidate_comps` (replaces old row if refreshing)
7. Returns `CompsResult` JSON

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const CACHE_DAYS = 7;

const VALID_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;

type ClaudeModel = (typeof VALID_MODELS)[number];

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { supabase, error: "Unauthorized" as const, status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { supabase, error: "Forbidden" as const, status: 403 as const };

  return { supabase, user, error: null, status: null };
}

const SYSTEM_PROMPT = `You are a real estate comparative market analysis expert. Given a subject property, find the top 8 most comparable recently sold homes and provide a price estimate.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no explanation outside the JSON). The JSON must follow this exact structure:

{
  "comps": [
    {
      "address": "Full street address with city, state, zip",
      "sold_price": 2100000,
      "sold_date": "Mon YYYY",
      "sqft": 1800,
      "beds": 3,
      "baths": 2,
      "lot_sqft": 6000,
      "similarity_score": 0.874,
      "price_per_sqft": 1167,
      "reason": "1-2 sentence explanation of why this comp was chosen"
    }
  ],
  "subject": {
    "address": "Subject property address",
    "sqft": 1820,
    "beds": 3,
    "baths": 2,
    "lot_sqft": 5227
  },
  "estimate": {
    "weighted_price_per_sqft": 1218,
    "comp_based": 2215000,
    "trend_adjusted": 2215000,
    "market_temperature": "warm",
    "trend_adjustment_pct": 0,
    "range": {
      "most_likely": [2125000, 2325000],
      "likely": [2025000, 2425000],
      "possible": [1925000, 2525000],
      "unlikely_below": 1925000,
      "unlikely_above": 2525000
    }
  },
  "market_signals": {
    "sale_to_list_ratio": "101%",
    "days_on_market": 15,
    "yoy_change": "-1.7%",
    "mom_change": "-12%"
  },
  "reasoning": "2-3 paragraph analysis explaining the estimate, market conditions, and key factors"
}

Similarity scoring rules:
- House Size (50% weight): score = max(0, 1 - abs(comp_sqft - subject_sqft) / subject_sqft / 0.20)
- Bed+Bath Count (30% weight): score = max(0, 1 - abs(comp_total - subject_total) / 3) where total = beds + baths
- Lot Size (20% weight): score = max(0, 1 - abs(comp_lot - subject_lot) / subject_lot / 0.30)

Price estimation:
- weighted_price_per_sqft = sum(comp_price_per_sqft * comp_score) / sum(comp_scores)
- Cap "most_likely" range at $200,000 wide maximum
- Build sub-ranges with $100,000 bands outward from most_likely
- Round all range boundaries to nearest $25,000

Market trend:
- Hot (price up >2% MoM): adjust up 2-5%
- Warm (price up 0-2% MoM): no adjustment
- Cool (price flat/declining): adjust down 2-5%

Return exactly 8 comps sorted by similarity_score descending. Use real recently sold data from your training knowledge for the area.`;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const modelParam = searchParams.get("model") || "claude-opus-4-6";
  const model: ClaudeModel = VALID_MODELS.includes(modelParam as ClaudeModel)
    ? (modelParam as ClaudeModel)
    : "claude-opus-4-6";

  // Fetch candidate home
  const { data: home, error: homeError } = await supabase
    .from("candidate_homes")
    .select("*")
    .eq("id", id)
    .single();

  if (homeError || !home) {
    return NextResponse.json({ error: "Candidate home not found" }, { status: 404 });
  }

  // Check cache (7-day expiry)
  if (!force) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CACHE_DAYS);

    const { data: cached } = await supabase
      .from("candidate_comps")
      .select("*")
      .eq("candidate_home_id", id)
      .gte("created_at", cutoff.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return NextResponse.json(cached.comps);
    }
  }

  // Build user prompt from candidate home data
  const address = home.address || home.title || "Unknown address";
  const userPrompt = `Perform a CMA for this subject property:

Address: ${address}
Price listed: ${home.price || "Unknown"}
Square footage: ${home.sqft || "Unknown"}
Bedrooms: ${home.beds || "Unknown"}
Bathrooms: ${home.baths || "Unknown"}

Find the top 8 comparable recently sold homes in the same area and provide the full analysis as JSON.`;

  // Call Claude API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON (handle possible markdown code fences)
    const jsonStr = rawText.replace(/^```json?\s*\n?/, "").replace(/\n?```\s*$/, "");
    const compsResult = JSON.parse(jsonStr);

    // Delete old cached results for this home
    await supabase
      .from("candidate_comps")
      .delete()
      .eq("candidate_home_id", id);

    // Save to cache
    await supabase.from("candidate_comps").insert({
      candidate_home_id: id,
      comps: compsResult,
      price_estimate: compsResult.estimate?.trend_adjusted || compsResult.estimate?.comp_based || null,
      price_range_low: compsResult.estimate?.range?.most_likely?.[0] || null,
      price_range_high: compsResult.estimate?.range?.most_likely?.[1] || null,
      market_temperature: compsResult.estimate?.market_temperature || null,
      reasoning: compsResult.reasoning || null,
      raw_response: rawText,
    });

    return NextResponse.json(compsResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Claude API call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add "src/app/api/admin/candidate-homes/[id]/comps/route.ts"
git commit -m "feat: add comps API endpoint with Claude integration and caching"
```

---

### Task 5: Create CompsModal Component

**Files:**
- Create: `src/components/portal/CompsModal.tsx`

**Step 1: Write the modal component**

The modal displays:
1. Subject property summary
2. Top 8 comps table with similarity scores
3. "Why selected" reasons
4. Price estimate with market trend
5. Price distribution visualization
6. Star-rated likelihood table
7. Reasoning paragraph
8. Model selector dropdown in header
9. Refresh button

```typescript
"use client";

import { useState } from "react";
import type { CompsResult } from "@/lib/types";

interface CompsModalProps {
  isOpen: boolean;
  onClose: () => void;
  homeAddress: string;
  homeId: string;
}

const MODELS = [
  { value: "claude-opus-4-6", label: "Opus 4.6 (Best)" },
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6 (Balanced)" },
  { value: "claude-haiku-4-5-20251001", label: "Haiku 4.5 (Fast)" },
];

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatFullPrice(n: number): string {
  return `$${n.toLocaleString()}`;
}

export default function CompsModal({ isOpen, onClose, homeAddress, homeId }: CompsModalProps) {
  const [model, setModel] = useState("claude-opus-4-6");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchComps(force = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ model });
      if (force) params.set("force", "true");
      const res = await fetch(`/api/admin/candidate-homes/${homeId}/comps?${params}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const data: CompsResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch comps");
    } finally {
      setLoading(false);
    }
  }

  // Auto-fetch on first open
  function handleOpen() {
    if (!result && !loading) fetchComps();
  }

  if (!isOpen) return null;

  // Trigger fetch on mount
  if (!result && !loading && !error) {
    handleOpen();
  }

  const r = result;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white w-full max-w-5xl mx-4 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="font-serif text-xl text-neutral-900">CMA Report</h2>
            <p className="text-sm text-neutral-500">{homeAddress}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs border border-neutral-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-[#d4a012]"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <button
              onClick={() => fetchComps(true)}
              disabled={loading}
              className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] disabled:opacity-50 px-3 py-1.5 border border-[#d4a012] rounded"
            >
              {loading ? "Analyzing..." : "Refresh"}
            </button>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-600 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-2 border-[#d4a012] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-neutral-500">Analyzing comparable sales...</p>
              <p className="text-xs text-neutral-400 mt-1">This may take 15-30 seconds</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-4 text-center">
              <p className="text-red-700 text-sm">{error}</p>
              <button onClick={() => fetchComps()} className="text-red-600 underline text-xs mt-2">
                Try again
              </button>
            </div>
          )}

          {r && !loading && (
            <div className="space-y-8">
              {/* Subject Property */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Subject Property</h3>
                <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
                  <p className="font-serif text-lg text-neutral-900">{r.subject.address}</p>
                  <div className="flex gap-6 mt-2 text-sm text-neutral-600">
                    <span>{r.subject.sqft?.toLocaleString()} sqft</span>
                    <span>{r.subject.beds} bd / {r.subject.baths} ba</span>
                    {r.subject.lot_sqft && <span>{r.subject.lot_sqft.toLocaleString()} sqft lot</span>}
                  </div>
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
                    <p className="text-xs text-neutral-400 mt-1">{r.estimate.trend_adjustment_pct >= 0 ? "+" : ""}{r.estimate.trend_adjustment_pct}% adjustment</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-4 text-center">
                    <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Market</p>
                    <p className="font-serif text-2xl capitalize text-neutral-900">{r.estimate.market_temperature}</p>
                    <p className="text-xs text-neutral-400 mt-1">MoM: {r.market_signals.mom_change}</p>
                  </div>
                </div>
              </section>

              {/* Price Range */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Price Range</h3>
                {/* Visual bar */}
                <div className="bg-neutral-50 border border-neutral-200 rounded p-4">
                  <div className="relative h-12 flex items-center">
                    <div className="absolute inset-x-0 h-3 bg-neutral-200 rounded-full">
                      {/* Possible band */}
                      <div className="absolute h-full bg-neutral-300 rounded-full" style={{
                        left: `${((r.estimate.range.possible[0] - r.estimate.range.unlikely_below) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                        right: `${((r.estimate.range.unlikely_above - r.estimate.range.possible[1]) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                      }} />
                      {/* Likely band */}
                      <div className="absolute h-full bg-[#d4a012]/40 rounded-full" style={{
                        left: `${((r.estimate.range.likely[0] - r.estimate.range.unlikely_below) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                        right: `${((r.estimate.range.unlikely_above - r.estimate.range.likely[1]) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                      }} />
                      {/* Most likely band */}
                      <div className="absolute h-full bg-[#d4a012] rounded-full" style={{
                        left: `${((r.estimate.range.most_likely[0] - r.estimate.range.unlikely_below) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                        right: `${((r.estimate.range.unlikely_above - r.estimate.range.most_likely[1]) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                      }} />
                    </div>
                    {/* Estimate marker */}
                    <div className="absolute z-10" style={{
                      left: `${((r.estimate.trend_adjusted - r.estimate.range.unlikely_below) / (r.estimate.range.unlikely_above - r.estimate.range.unlikely_below)) * 100}%`,
                    }}>
                      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-neutral-900 -translate-x-1/2 -translate-y-1" />
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                    <span>{formatMoney(r.estimate.range.unlikely_below)}</span>
                    <span>{formatMoney(r.estimate.trend_adjusted)} est.</span>
                    <span>{formatMoney(r.estimate.range.unlikely_above)}</span>
                  </div>
                </div>

                {/* Likelihood table */}
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
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-center">
                    <p className="text-xs text-neutral-500 mb-1">Sale-to-List</p>
                    <p className="font-medium text-neutral-900">{r.market_signals.sale_to_list_ratio}</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-center">
                    <p className="text-xs text-neutral-500 mb-1">Days on Market</p>
                    <p className="font-medium text-neutral-900">{r.market_signals.days_on_market}</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-center">
                    <p className="text-xs text-neutral-500 mb-1">YoY Change</p>
                    <p className="font-medium text-neutral-900">{r.market_signals.yoy_change}</p>
                  </div>
                  <div className="bg-neutral-50 border border-neutral-200 rounded p-3 text-center">
                    <p className="text-xs text-neutral-500 mb-1">MoM Change</p>
                    <p className="font-medium text-neutral-900">{r.market_signals.mom_change}</p>
                  </div>
                </div>
              </section>

              {/* Comps Table */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Top 8 Comparable Sales</h3>
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
                        <th className="pb-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {r.comps.map((comp, i) => (
                        <tr key={i} className="hover:bg-neutral-50">
                          <td className="py-2 pr-3 text-neutral-400">{i + 1}</td>
                          <td className="py-2 pr-3 text-neutral-900 max-w-[200px] truncate">{comp.address}</td>
                          <td className="py-2 pr-3 text-right font-medium">{formatFullPrice(comp.sold_price)}</td>
                          <td className="py-2 pr-3 text-neutral-500">{comp.sold_date}</td>
                          <td className="py-2 pr-3 text-right">{comp.sqft.toLocaleString()}</td>
                          <td className="py-2 pr-3">{comp.beds}/{comp.baths}</td>
                          <td className="py-2 pr-3 text-right">${comp.price_per_sqft}</td>
                          <td className="py-2 text-right">
                            <span className="inline-block px-2 py-0.5 text-xs rounded bg-[#d4a012]/10 text-[#d4a012] font-medium">
                              {(comp.similarity_score * 100).toFixed(0)}%
                            </span>
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

              {/* Reasoning */}
              <section>
                <h3 className="text-xs uppercase tracking-[0.2em] text-[#d4a012] mb-3">Analysis</h3>
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line">{r.reasoning}</p>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/portal/CompsModal.tsx
git commit -m "feat: add CompsModal component for CMA report display"
```

---

### Task 6: Add "Find Comps" Button to CandidateHomeCard

**Files:**
- Modify: `src/components/portal/CandidateHomeCard.tsx`

**Step 1: Add state, import, and button**

Changes to make:
1. Add `useState` import from React
2. Import `CompsModal`
3. Add state for modal open/close
4. Add "Find Comps" button in the action bar (next to "View Listing")
5. Render `CompsModal` at bottom of component

In `CandidateHomeCard.tsx`:

Add imports at top:
```typescript
import { useState } from "react";
import CompsModal from "./CompsModal";
```

Add state inside the component function:
```typescript
const [compsOpen, setCompsOpen] = useState(false);
```

Add button in the action bar `<div className="flex items-center gap-3 ...">` after the "View Listing" link:
```tsx
<button
  onClick={() => setCompsOpen(true)}
  className="text-xs uppercase tracking-wider text-neutral-500 hover:text-[#d4a012] transition-colors"
>
  Find Comps
</button>
```

Add modal render at the end, before the closing `</div>` of the card:
```tsx
<CompsModal
  isOpen={compsOpen}
  onClose={() => setCompsOpen(false)}
  homeAddress={home.address || home.title || "Unknown"}
  homeId={home.id}
/>
```

**Step 2: Verify the dev server renders correctly**

Run: `npm run dev`
Navigate to admin portal → Candidate Homes tab → verify "Find Comps" button appears on each card.

**Step 3: Commit**

```bash
git add src/components/portal/CandidateHomeCard.tsx
git commit -m "feat: add Find Comps button to CandidateHomeCard"
```

---

### Task 7: End-to-End Test

**Step 1: Run the Supabase migration**

Execute the SQL from Task 1 in Supabase SQL Editor.

**Step 2: Add ANTHROPIC_API_KEY to .env.local**

Ensure `.env.local` has a valid `ANTHROPIC_API_KEY`.

**Step 3: Test the full flow**

1. Start dev server: `npm run dev`
2. Log in as admin
3. Go to Candidate Homes tab
4. Click "Find Comps" on any card with address/beds/baths/sqft
5. Verify modal opens with loading spinner
6. Verify CMA report renders with all sections
7. Test model selector dropdown (change to Sonnet, click Refresh)
8. Verify cache: click "Find Comps" again on same card — should load instantly
9. Verify force refresh: click "Refresh" button — should re-analyze

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Find Comps CMA feature with Claude API integration"
```
