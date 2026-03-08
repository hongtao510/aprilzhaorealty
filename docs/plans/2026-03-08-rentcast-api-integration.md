# RentCast API Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Claude's hallucinated comp data with real property records, comparable sales, and market statistics from the RentCast API.

**Architecture:** Create a RentCast API client (`src/lib/rentcast.ts`) that wraps three endpoints: property records, AVM value estimates (which include real comparable sales), and market statistics. The comps route (`src/app/api/admin/candidate-homes/[id]/comps/route.ts`) will call RentCast first to gather real data, then pass that data to Claude for analysis, scoring, and narrative — Claude analyzes real data instead of inventing it. Subject property details are also auto-populated from RentCast when a candidate home is added.

**Tech Stack:** Next.js API routes, RentCast REST API (v1), Anthropic Claude API, Supabase

---

### Task 1: Add RentCast API Key to Environment

**Files:**
- Modify: `.env.local` (line 11, after ANTHROPIC_API_KEY)

**Step 1: Add the API key**

Add this line after the Anthropic key:

```
# RentCast Property Data API
RENTCAST_API_KEY=653a7dc8a3b149149be8822e37147c93
```

**Step 2: Verify**

Run: `grep RENTCAST .env.local`
Expected: Shows the RENTCAST_API_KEY line

---

### Task 2: Create RentCast API Client

**Files:**
- Create: `src/lib/rentcast.ts`

**Step 1: Write the RentCast client module**

```typescript
const RENTCAST_BASE = "https://api.rentcast.io/v1";

function getApiKey(): string {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error("RENTCAST_API_KEY is not set in .env.local");
  return key;
}

async function rentcastFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${RENTCAST_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": getApiKey() },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RentCast API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface RentCastProperty {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  features?: Record<string, unknown>;
  taxAssessments?: Record<string, { value: number; land: number; improvements: number }>;
  owner?: { names: string[]; type: string };
}

export interface RentCastAVMResult {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  pricePerSquareFoot: number;
  subjectProperty: {
    id: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt: number;
    lastSaleDate: string | null;
    lastSalePrice: number | null;
  };
  comparables: RentCastComparable[];
}

export interface RentCastComparable {
  id: string;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  distance: number;
  correlation: number;
  price: number;
}

export interface RentCastMarketStats {
  zipCode: string;
  saleSummary?: {
    averagePrice?: number;
    medianPrice?: number;
    averagePricePerSquareFoot?: number;
    averageDaysOnMarket?: number;
    totalListings?: number;
  };
  trends?: Record<string, unknown>;
}

// --- API Functions ---

/**
 * Get property record by address. Returns the first matching property.
 */
export async function getPropertyRecord(address: string): Promise<RentCastProperty | null> {
  try {
    const results = await rentcastFetch<RentCastProperty[]>("/properties", {
      address,
      limit: "1",
    });
    return results?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get AVM value estimate with comparable properties.
 */
export async function getValueEstimate(
  address: string,
  opts?: { propertyType?: string; compCount?: number }
): Promise<RentCastAVMResult | null> {
  try {
    const params: Record<string, string> = { address };
    if (opts?.propertyType) params.propertyType = opts.propertyType;
    if (opts?.compCount) params.compCount = String(opts.compCount);
    return await rentcastFetch<RentCastAVMResult>("/avm/value", params);
  } catch {
    return null;
  }
}

/**
 * Get market statistics for a zip code.
 */
export async function getMarketStatistics(zipCode: string): Promise<RentCastMarketStats | null> {
  try {
    return await rentcastFetch<RentCastMarketStats>("/markets", { zipCode });
  } catch {
    return null;
  }
}
```

**Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/lib/rentcast.ts` (or rely on dev server)

**Step 3: Commit**

```bash
git add src/lib/rentcast.ts
git commit -m "feat: add RentCast API client for property data"
```

---

### Task 3: Update Comps Route to Use RentCast Data

**Files:**
- Modify: `src/app/api/admin/candidate-homes/[id]/comps/route.ts`

**Step 1: Import RentCast client**

Add at the top of the file, after existing imports:

```typescript
import { getPropertyRecord, getValueEstimate, getMarketStatistics } from "@/lib/rentcast";
```

**Step 2: Add a RentCast data-fetching function**

Add this function after `verifyAdmin()` and before `SYSTEM_PROMPT`:

```typescript
async function fetchRentCastData(address: string, zipCode?: string) {
  const [property, avm, market] = await Promise.all([
    getPropertyRecord(address),
    getValueEstimate(address, { compCount: 20 }),
    zipCode ? getMarketStatistics(zipCode) : Promise.resolve(null),
  ]);
  return { property, avm, market };
}
```

**Step 3: Update the SYSTEM_PROMPT**

Replace the entire `SYSTEM_PROMPT` constant. The new prompt tells Claude it will receive REAL data from RentCast and should analyze it (not invent data):

```typescript
const SYSTEM_PROMPT = `You are a real estate Comparative Market Analysis (CMA) expert. You will receive REAL property data from RentCast API — real comparable sales, real property records, and real market statistics. Your job is to ANALYZE this real data and produce a structured CMA report.

Return ONLY valid JSON matching the CompsResult schema — no markdown, no code fences, no explanation.

=== YOUR TASK ===
1. You will receive the subject property details (from RentCast property records)
2. You will receive a list of comparable properties with sale prices (from RentCast AVM)
3. You will receive market statistics (from RentCast market data)
4. Score each comp, select the top 8, compute a price estimate, and produce the JSON output

=== SIMILARITY SCORING (scores are 0.0-1.0 decimals) ===
Criterion 1 — House Size (50% weight):
  size_diff = abs(comp_sqft - subject_sqft) / subject_sqft
  score = max(0, 1 - size_diff / 0.20)
  Similar if within 20% of subject sqft

Criterion 2 — Bed+Bath Count (30% weight):
  diff = abs((comp_beds + comp_baths) - (subject_beds + subject_baths))
  score = max(0, 1 - diff / 3)
  Similar if total bed+bath count differs by 3 or less

Criterion 3 — Lot Size (20% weight):
  lot_diff = abs(comp_lot - subject_lot) / subject_lot
  score = max(0, 1 - lot_diff / 0.30)
  Similar if within 30% of subject lot size

Combined: total_score = 0.50 * size_score + 0.30 * bedbath_score + 0.20 * lot_score
Filter out any comp where ALL three scores = 0.
Tie-breaking: closer distance wins, then more recent sale date wins.

=== PRICE ESTIMATION ===
1. IGNORE the subject property's listing price — it can be misleading
2. For each comp: price_per_sqft = comp_sold_price / comp_sqft
3. Weighted average: estimated_price_per_sqft = sum(comp_price_per_sqft * comp_score) / sum(comp_scores)
4. comp_based estimate = estimated_price_per_sqft * subject_sqft
5. Round estimate to nearest $1,000

=== MARKET TREND ADJUSTMENT ===
Use the provided market statistics to classify market temperature:
- "hot": median price up >2% MoM, homes selling above list, <14 days on market → adjust UP 2-5%
- "warm": median price up 0-2% MoM, selling near list, 14-30 days on market → NO adjustment
- "cool": median price flat/declining MoM, selling below list, >30 days on market → adjust DOWN 2-5%

trend_adjusted = comp_based * (1 + trend_adjustment_pct / 100)

=== RANGE BUILDING ===
1. Collect all comp-implied prices: comp_price_per_sqft * subject_sqft (trend-adjusted)
2. Compute weighted mean and weighted standard deviation
3. Cap "most_likely" half-width: half_width = min(0.5 * std, 100000) — max $200k total width
4. Build sub-ranges with $100,000 bands outward:
   - most_likely (50%): [mean - half_width, mean + half_width]
   - likely (25%): [mean - half_width - 100k, mean + half_width + 100k]
   - possible (15%): [mean - half_width - 200k, mean + half_width + 200k]
   - unlikely_below: below possible low
   - unlikely_above: above possible high
5. Round all range boundaries to nearest $25,000

=== OUTPUT SCHEMA ===
CompsResult:
{
  "comps": [CompHome, ...],          // top 8 comparable recently-sold homes from the provided data
  "subject": { "address": string, "sqft": number, "beds": number, "baths": number, "lot_sqft": number },
  "estimate": {
    "weighted_price_per_sqft": number,
    "comp_based": number,
    "trend_adjusted": number,
    "market_temperature": "hot" | "warm" | "cool",
    "trend_adjustment_pct": number,
    "range": {
      "most_likely": [low, high],
      "likely": [low, high],
      "possible": [low, high],
      "unlikely_below": number,
      "unlikely_above": number
    }
  },
  "market_signals": {
    "sale_to_list_ratio": string,
    "days_on_market": number,
    "yoy_change": string,
    "mom_change": string
  },
  "reasoning": string
}

CompHome:
{
  "address": string,
  "sold_price": number,
  "sold_date": string,
  "sqft": number,
  "beds": number,
  "baths": number,
  "lot_sqft": number,
  "similarity_score": number,
  "price_per_sqft": number,
  "reason": string,
  "redfin_url": string,
  "distance_miles": number
}`;
```

**Step 4: Modify the POST handler to call RentCast before Claude**

In both streaming and non-streaming paths, after fetching the candidate home and checking cache, add a RentCast data fetch step. Then build the user prompt with the real data.

Replace the section from "Build user prompt" to the end of the `userPrompt` const with:

```typescript
  // === Fetch real data from RentCast ===
  const address = home.address || home.title || "Unknown address";
  const price = home.price || home.price_numeric || "Unknown";
  const sourceUrl = home.url || null;

  // Extract zip code from address for market stats
  const zipMatch = (home.address || "").match(/\b(\d{5})\b/);
  const zipCode = zipMatch?.[1] || null;

  let rentcastProperty: Awaited<ReturnType<typeof getPropertyRecord>> = null;
  let rentcastAVM: Awaited<ReturnType<typeof getValueEstimate>> = null;
  let rentcastMarket: Awaited<ReturnType<typeof getMarketStatistics>> = null;
  let rentcastError: string | null = null;

  if (process.env.RENTCAST_API_KEY) {
    const sendLog = stream
      ? (msg: string) => {
          // We'll set up the stream send function later; for now collect logs
        }
      : () => {};

    try {
      const rcData = await fetchRentCastData(address, zipCode ?? undefined);
      rentcastProperty = rcData.property;
      rentcastAVM = rcData.avm;
      rentcastMarket = rcData.market;
    } catch (err) {
      rentcastError = err instanceof Error ? err.message : "RentCast API error";
    }
  }

  // Use RentCast data to fill in subject property details (override scraped values)
  const subjectBeds = rentcastProperty?.bedrooms ?? home.beds ?? "Unknown";
  const subjectBaths = rentcastProperty?.bathrooms ?? home.baths ?? "Unknown";
  const subjectSqft = rentcastProperty?.squareFootage ?? home.sqft ?? "Unknown";
  const subjectLot = rentcastProperty?.lotSize ?? home.lot_sqft ?? "Unknown";
  const subjectYearBuilt = rentcastProperty?.yearBuilt ?? "Unknown";
  const propertyType = rentcastProperty?.propertyType ?? home.property_type ?? "Single Family";

  // Update candidate_homes with RentCast data if we got better info
  if (rentcastProperty) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (!home.beds && rentcastProperty.bedrooms) updates.beds = rentcastProperty.bedrooms;
    if (!home.baths && rentcastProperty.bathrooms) updates.baths = rentcastProperty.bathrooms;
    if (!home.sqft && rentcastProperty.squareFootage) updates.sqft = rentcastProperty.squareFootage;
    if (Object.keys(updates).length > 1) {
      await supabase.from("candidate_homes").update(updates).eq("id", id);
    }
  }

  // Build user prompt with REAL data
  const hasRentCastComps = rentcastAVM && rentcastAVM.comparables?.length > 0;

  let userPrompt = `Perform a CMA for this subject property:

Address: ${address}
Property Type: ${propertyType}
List Price: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}
Square Feet: ${subjectSqft}
Bedrooms: ${subjectBeds}
Bathrooms: ${subjectBaths}
Lot Size: ${typeof subjectLot === "number" ? `${subjectLot.toLocaleString()} sqft` : subjectLot}
Year Built: ${subjectYearBuilt}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}`;

  if (hasRentCastComps) {
    userPrompt += `

=== REAL COMPARABLE SALES DATA (from RentCast API) ===
RentCast AVM Estimate: $${rentcastAVM!.price.toLocaleString()} (range: $${rentcastAVM!.priceRangeLow.toLocaleString()} - $${rentcastAVM!.priceRangeHigh.toLocaleString()})

Here are ${rentcastAVM!.comparables.length} real comparable properties. Score each using the similarity formula, select the top 8, and produce the CMA report:

${rentcastAVM!.comparables.map((c, i) => `${i + 1}. ${c.formattedAddress}
   Sold Price: $${(c.lastSalePrice || c.price).toLocaleString()}
   Sold Date: ${c.lastSaleDate || "N/A"}
   Sqft: ${c.squareFootage} | Beds: ${c.bedrooms} | Baths: ${c.bathrooms}
   Lot: ${c.lotSize ? c.lotSize.toLocaleString() + " sqft" : "N/A"}
   Distance: ${c.distance.toFixed(2)} miles | RentCast Correlation: ${c.correlation}
   City: ${c.city}, ${c.state} ${c.zipCode}
`).join("\n")}`;
  }

  if (rentcastMarket?.saleSummary) {
    const ms = rentcastMarket.saleSummary;
    userPrompt += `

=== MARKET STATISTICS (from RentCast API — zip ${zipCode}) ===
Average Price: ${ms.averagePrice ? `$${ms.averagePrice.toLocaleString()}` : "N/A"}
Median Price: ${ms.medianPrice ? `$${ms.medianPrice.toLocaleString()}` : "N/A"}
Avg Price/SqFt: ${ms.averagePricePerSquareFoot ? `$${ms.averagePricePerSquareFoot}` : "N/A"}
Avg Days on Market: ${ms.averageDaysOnMarket ?? "N/A"}
Total Active Listings: ${ms.totalListings ?? "N/A"}`;
  }

  if (!hasRentCastComps) {
    userPrompt += `

NOTE: RentCast comparable data was not available${rentcastError ? ` (${rentcastError})` : ""}. Use your knowledge of recently sold homes in this area to find comparables. Use ACTUAL SOLD prices only.`;
  }

  userPrompt += `

Score each comp using the similarity formula, rank by score, and produce the CompsResult JSON. Remember to IGNORE the listing price when computing the price estimate.`;
```

**Step 5: Update streaming path to log RentCast steps**

In the streaming `start()` function, after the initial log messages (`Subject: ...`, `Details: ...`), add RentCast status logs. Replace the existing initial log section with:

```typescript
        send("log", { message: `Subject: ${address}` });
        send("log", { message: `Details: ${subjectBeds} bed / ${subjectBaths} bath / ${subjectSqft} sqft` });
        send("log", { message: `Listed at: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}` });

        if (rentcastProperty) {
          send("log", { message: "" });
          send("log", { message: "✓ RentCast: Subject property data loaded" });
          send("log", { message: `  Year Built: ${subjectYearBuilt} | Lot: ${typeof subjectLot === "number" ? subjectLot.toLocaleString() + " sqft" : subjectLot}` });
        }
        if (rentcastAVM) {
          send("log", { message: `✓ RentCast: AVM estimate $${rentcastAVM.price.toLocaleString()} (${rentcastAVM.comparables.length} comps)` });
        }
        if (rentcastMarket) {
          send("log", { message: `✓ RentCast: Market statistics loaded for zip ${zipCode}` });
        }
        if (rentcastError) {
          send("log", { message: `Warning: RentCast API: ${rentcastError}` });
        }
        if (!hasRentCastComps) {
          send("log", { message: "Note: No RentCast comps available — Claude will use training data" });
        }

        send("log", { message: "" });
        send("log", { message: `Connecting to Claude API (${model})...` });
```

**Step 6: Add `distance_miles` to CompHome type**

In `src/lib/types.ts`, add to the `CompHome` interface:

```typescript
  distance_miles?: number;
```

**Step 7: Commit**

```bash
git add src/app/api/admin/candidate-homes/[id]/comps/route.ts src/lib/types.ts
git commit -m "feat: integrate RentCast API for real CMA comparable data"
```

---

### Task 4: Auto-Populate Subject Details When Adding Candidate Home

**Files:**
- Modify: `src/app/api/admin/candidate-homes/route.ts`

**Step 1: Import RentCast client**

Add after existing imports:

```typescript
import { getPropertyRecord } from "@/lib/rentcast";
```

**Step 2: In the POST handler, after scraping OG tags, call RentCast**

After the OG scraping try/catch block (around line 160), before the insert, add:

```typescript
  // Enrich with RentCast property data (more accurate than OG scraping)
  if (process.env.RENTCAST_API_KEY && preview.address) {
    try {
      const rcProperty = await getPropertyRecord(preview.address);
      if (rcProperty) {
        if (!preview.beds && rcProperty.bedrooms) preview.beds = rcProperty.bedrooms;
        if (!preview.baths && rcProperty.bathrooms) preview.baths = rcProperty.bathrooms;
        if (!preview.sqft && rcProperty.squareFootage) preview.sqft = rcProperty.squareFootage;
      }
    } catch {
      // RentCast enrichment is best-effort
    }
  }
```

**Step 3: Commit**

```bash
git add src/app/api/admin/candidate-homes/route.ts
git commit -m "feat: auto-populate property details from RentCast when adding candidate"
```

---

### Task 5: Update Comps Page UI for RentCast Data Source Indicator

**Files:**
- Modify: `src/app/(portal)/admin/comps/[id]/page.tsx`

**Step 1: Add distance column to comps table**

In the comps table header row, add after the "Source" th:

```tsx
<th className="pb-2 pr-3 text-right">Distance</th>
```

In the comps table body, add after the Source td:

```tsx
<td className="py-2 text-right text-xs text-neutral-400">
  {comp.distance_miles ? `${comp.distance_miles.toFixed(1)} mi` : "—"}
</td>
```

**Step 2: Commit**

```bash
git add src/app/(portal)/admin/comps/[id]/page.tsx
git commit -m "feat: show comp distance in CMA results table"
```

---

### Task 6: Add .env.local to .env.example (if exists) and Verify End-to-End

**Step 1: Run the dev server**

Run: `npm run dev`

**Step 2: Test by opening a candidate home's comps page**

Open the comps page for an existing candidate home. Verify:
- RentCast log messages appear in console
- Real comparable data is used
- Subject property details are populated from RentCast
- Distance column shows real distances

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete RentCast API integration for CMA data"
```
