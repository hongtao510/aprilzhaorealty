import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { CompsResult } from "@/lib/types";
import {
  getPropertyRecord,
  getValueEstimate,
  getMarketStatistics,
  type RentCastAVMResult,
  type RentCastProperty,
  type RentCastMarketStats,
} from "@/lib/rentcast";
import {
  getClosedListings,
  type SimplyRetsListing,
} from "@/lib/simplyrets";

const VALID_MODELS = [
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;
type ValidModel = (typeof VALID_MODELS)[number];

const CACHE_DAYS = 7;

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { supabase, error: "Unauthorized" as const, status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    return { supabase, error: "Forbidden" as const, status: 403 as const };

  return { supabase, user, error: null, status: null };
}

async function fetchRentCastData(address: string, zipCode?: string) {
  const [property, avm, market] = await Promise.all([
    getPropertyRecord(address),
    getValueEstimate(address, { compCount: 20 }),
    zipCode ? getMarketStatistics(zipCode) : Promise.resolve(null),
  ]);
  return { property, avm, market };
}

async function fetchSimplyRetsComps(opts: {
  city?: string;
  postalCode?: string;
  state?: string;
  beds?: number;
  sqft?: number;
  propertyType?: string;
}): Promise<SimplyRetsListing[]> {
  // Search for recently closed listings in the same area
  // Widen bed/bath range by ±1 to get more candidates for scoring
  const minBeds = opts.beds ? Math.max(0, opts.beds - 1) : undefined;
  const maxBeds = opts.beds ? opts.beds + 1 : undefined;
  // Widen sqft range by ±30% for broader search
  const minArea = opts.sqft ? Math.round(opts.sqft * 0.7) : undefined;
  const maxArea = opts.sqft ? Math.round(opts.sqft * 1.3) : undefined;

  // Map property type to SimplyRETS type
  let type: string | undefined;
  const pt = (opts.propertyType || "").toLowerCase();
  if (pt.includes("condo")) type = "condominium";
  else if (pt.includes("town")) type = "residential";
  else if (pt.includes("multi")) type = "multifamily";
  else type = "residential";

  return getClosedListings({
    city: opts.city,
    postalCode: opts.postalCode,
    state: opts.state,
    minBeds,
    maxBeds,
    minArea,
    maxArea,
    type,
    limit: 50,
    sort: "-closedate",
  });
}

const SYSTEM_PROMPT = `You are a real estate Comparative Market Analysis (CMA) expert. You will receive REAL property data from RentCast API — real comparable sales, real property records, and real market statistics. Your job is to ANALYZE this real data and produce a structured CMA report.

Return ONLY valid JSON matching the CompsResult schema — no markdown, no code fences, no explanation.

=== YOUR TASK ===
1. You will receive the subject property details (from RentCast property records)
2. You will receive a list of comparable properties with sale prices (from RentCast AVM)
3. You may receive market statistics (from RentCast market data)
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

Combined: similarity_score = 0.50 * size_score + 0.30 * bedbath_score + 0.20 * lot_score
Filter out any comp where ALL three scores = 0.

=== RECENCY SCORING ===
Apply a recency multiplier to the similarity score based on how recently the comp sold:
  months_ago = months between comp sold date and today
  if months_ago <= 3:  recency_multiplier = 1.00  (full weight — very recent)
  if months_ago <= 6:  recency_multiplier = 0.95  (slight discount)
  if months_ago <= 9:  recency_multiplier = 0.85  (moderate discount)
  if months_ago <= 12: recency_multiplier = 0.70  (heavy discount — only keep if similarity is high)
  if months_ago <= 18: recency_multiplier = 0.50  (very heavy discount — only keep if specs are very close)

  total_score = similarity_score * recency_multiplier

TIER 2 GATE: If months_ago > 6 and <= 12, the comp is ONLY kept if similarity_score >= 0.80 (before recency adjustment).
This ensures older comps must be very close matches to be useful.

TIER 3 GATE: If months_ago > 12 and <= 18, the comp is ONLY kept if ALL THREE individual criteria scores are >= 0.90.
That means: size within 10%, bed+bath count within 10%, and lot size within 10% of the subject. Only near-identical properties qualify.

Comps older than 18 months: EXCLUDE entirely.

RECENCY TIERS:
- Tier 1 (0-6 months): Always include. These are the most relevant comps.
- Tier 2 (6-12 months): Only include if similarity_score >= 0.80.
- Tier 3 (12-18 months): Only include if all three criteria scores >= 0.90 (specs within 10%).
- Beyond 18 months: Exclude entirely.

Tie-breaking: more recent sale date wins, then closer distance wins.

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
    "trend_adjustment_pct": number,  // e.g. 2.5 means +2.5%
    "range": {
      "most_likely": [low, high],
      "likely": [low, high],
      "possible": [low, high],
      "unlikely_below": number,
      "unlikely_above": number
    }
  },
  "market_signals": {
    "sale_to_list_ratio": string,    // e.g. "102%"
    "days_on_market": number,
    "yoy_change": string,            // e.g. "+5.2%"
    "mom_change": string             // e.g. "+0.8%"
  },
  "reasoning": string               // 2-4 sentence CMA narrative
}

CompHome:
{
  "address": string,
  "sold_price": number,
  "sold_date": string,              // YYYY-MM-DD
  "sqft": number,
  "beds": number,
  "baths": number,
  "lot_sqft": number,
  "similarity_score": number,       // 0.0-1.0, computed per rules above
  "price_per_sqft": number,
  "reason": string,                 // 1-2 sentences: why this comp was chosen
  "redfin_url": string,             // Redfin listing URL for this comp
  "distance_miles": number          // Distance from subject property in miles
}`;

function formatSimplyRetsLot(listing: SimplyRetsListing): string {
  if (listing.property.lotSizeArea && listing.property.lotSizeAreaUnits) {
    if (listing.property.lotSizeAreaUnits.toLowerCase().includes("squa")) {
      return `${listing.property.lotSizeArea.toLocaleString()} sqft`;
    }
  }
  if (listing.property.acres) {
    return `${(listing.property.acres * 43560).toLocaleString()} sqft`;
  }
  if (listing.property.lotSize) return listing.property.lotSize;
  return "N/A";
}

function buildUserPrompt(opts: {
  address: string;
  price: string | number;
  subjectBeds: number | string;
  subjectBaths: number | string;
  subjectSqft: number | string;
  subjectLot: number | string;
  subjectYearBuilt: number | string;
  propertyType: string;
  sourceUrl: string | null;
  rentcastAVM: RentCastAVMResult | null;
  rentcastMarket: RentCastMarketStats | null;
  rentcastError: string | null;
  simplyRetsListings: SimplyRetsListing[];
  simplyRetsError: string | null;
}) {
  const {
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl,
    rentcastAVM, rentcastMarket, rentcastError,
    simplyRetsListings, simplyRetsError,
  } = opts;

  let prompt = `Perform a CMA for this subject property:

Address: ${address}
Property Type: ${propertyType}
List Price: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}
Square Feet: ${subjectSqft}
Bedrooms: ${subjectBeds}
Bathrooms: ${subjectBaths}
Lot Size: ${typeof subjectLot === "number" ? `${subjectLot.toLocaleString()} sqft` : subjectLot}
Year Built: ${subjectYearBuilt}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}`;

  // --- SimplyRETS MLS closed listings (most authoritative) ---
  const mlsComps = simplyRetsListings.filter(
    (l) => l.sales.closePrice && l.sales.closePrice > 0
  );

  if (mlsComps.length > 0) {
    prompt += `

=== MLS CLOSED SALES DATA (from SimplyRETS — authoritative MLS records) ===
${mlsComps.length} recently closed MLS listings found. These have verified close prices from the MLS. Prioritize these over other data sources.

${mlsComps.map((l, i) => `${i + 1}. ${l.address.full}, ${l.address.city}, ${l.address.state} ${l.address.postalCode}
   Close Price: $${l.sales.closePrice!.toLocaleString()}
   Close Date: ${l.sales.closeDate || "N/A"}
   List Price: $${l.listPrice.toLocaleString()} | Days on Market: ${l.mls.daysOnMarket}
   Sqft: ${l.property.area} | Beds: ${l.property.bedrooms} | Baths: ${l.property.bathrooms}
   Lot: ${formatSimplyRetsLot(l)}
   Year Built: ${l.property.yearBuilt || "N/A"}
   MLS#: ${l.listingId} | Status: ${l.mls.statusText || l.mls.status}
`).join("\n")}`;
  } else if (simplyRetsError) {
    prompt += `

Note: SimplyRETS MLS data unavailable (${simplyRetsError}).`;
  }

  // --- RentCast AVM comparables (supplementary) ---
  const hasRentCastComps = rentcastAVM && rentcastAVM.comparables?.length > 0;

  if (hasRentCastComps) {
    prompt += `

=== ADDITIONAL COMPARABLE DATA (from RentCast AVM) ===
RentCast AVM Estimate: $${rentcastAVM!.price.toLocaleString()} (range: $${rentcastAVM!.priceRangeLow.toLocaleString()} - $${rentcastAVM!.priceRangeHigh.toLocaleString()})

${rentcastAVM!.comparables.length} additional comparable properties${mlsComps.length > 0 ? " (use these to supplement the MLS data above — avoid duplicates)" : ""}:

${rentcastAVM!.comparables.map((c, i) => `${i + 1}. ${c.formattedAddress}
   Sold Price: $${(c.lastSalePrice || c.price).toLocaleString()}
   Sold Date: ${c.lastSaleDate || "N/A"}
   Sqft: ${c.squareFootage} | Beds: ${c.bedrooms} | Baths: ${c.bathrooms}
   Lot: ${c.lotSize ? c.lotSize.toLocaleString() + " sqft" : "N/A"}
   Distance: ${c.distance.toFixed(2)} miles | RentCast Correlation: ${c.correlation}
   City: ${c.city}, ${c.state} ${c.zipCode}
`).join("\n")}`;
  }

  // --- Market statistics ---
  if (rentcastMarket?.saleSummary) {
    const ms = rentcastMarket.saleSummary;
    prompt += `

=== MARKET STATISTICS (from RentCast API) ===
Average Price: ${ms.averagePrice ? `$${ms.averagePrice.toLocaleString()}` : "N/A"}
Median Price: ${ms.medianPrice ? `$${ms.medianPrice.toLocaleString()}` : "N/A"}
Avg Price/SqFt: ${ms.averagePricePerSquareFoot ? `$${ms.averagePricePerSquareFoot}` : "N/A"}
Avg Days on Market: ${ms.averageDaysOnMarket ?? "N/A"}
Total Active Listings: ${ms.totalListings ?? "N/A"}`;
  }

  // --- Fallback if no data from either source ---
  if (mlsComps.length === 0 && !hasRentCastComps) {
    prompt += `

NOTE: No comparable data was available from SimplyRETS${simplyRetsError ? ` (${simplyRetsError})` : ""} or RentCast${rentcastError ? ` (${rentcastError})` : ""}. Use your knowledge of recently sold homes in this area to find comparables. Use ACTUAL SOLD prices only.`;
  }

  const hasUnknowns = [subjectSqft, subjectBeds, subjectBaths, subjectLot].some(
    (v) => v === "Unknown" || v === null
  );

  if (hasUnknowns) {
    prompt += `

IMPORTANT: Some property details above are "Unknown". You MUST research the correct details for this property based on the address. The "subject" field in your response MUST contain the correct values.`;
  }

  prompt += `

Score each comp using the similarity formula with recency adjustment, rank by total_score (recency-adjusted), select the top 8, and produce the CompsResult JSON. Apply the Tier 2 gate: exclude comps 6-12 months old unless similarity_score >= 0.80. Apply the Tier 3 gate: exclude comps 12-18 months old unless all three criteria scores >= 0.90 (specs within 10%). Exclude comps older than 18 months entirely. When MLS data and RentCast data overlap (same address), prefer the MLS close price. Remember to IGNORE the listing price when computing the price estimate.`;

  return prompt;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const stream = searchParams.get("stream") === "true";
  const modelParam = searchParams.get("model") || "claude-sonnet-4-6";

  if (!VALID_MODELS.includes(modelParam as ValidModel)) {
    return NextResponse.json(
      { error: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` },
      { status: 400 }
    );
  }
  const model = modelParam as ValidModel;

  // Fetch candidate home
  const { data: home, error: homeError } = await supabase
    .from("candidate_homes")
    .select("*")
    .eq("id", id)
    .single();

  if (homeError || !home) {
    return NextResponse.json(
      { error: "Candidate home not found" },
      { status: 404 }
    );
  }

  // Check cache (unless force refresh)
  if (!force) {
    const cacheThreshold = new Date();
    cacheThreshold.setDate(cacheThreshold.getDate() - CACHE_DAYS);

    const { data: cached } = await supabase
      .from("candidate_comps")
      .select("comps")
      .eq("candidate_home_id", id)
      .gte("created_at", cacheThreshold.toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      if (stream) {
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            const send = (event: string, data: unknown) => {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
            };
            send("log", { message: "Found cached CMA report (less than 7 days old)" });
            send("log", { message: "Returning cached results" });
            send("result", cached.comps);
            send("done", {});
            controller.close();
          },
        });
        return new Response(body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }
      return NextResponse.json(cached.comps as CompsResult);
    }
  }

  // Check for API key early
  if (!process.env.ANTHROPIC_API_KEY) {
    const msg = "ANTHROPIC_API_KEY is not set in .env.local";
    if (stream) {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
        },
      });
      return new Response(body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
      });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // === Fetch real data from RentCast + SimplyRETS ===
  const address = home.address || home.title || "Unknown address";
  const price = home.price || home.price_numeric || "Unknown";
  const sourceUrl = home.url || null;

  // Parse city, state, zip from address
  const zipMatch = (home.address || "").match(/\b(\d{5})\b/);
  const zipCode = zipMatch?.[1] || null;
  // Try to extract city from address like "123 Main St, Burlingame, CA 94010"
  const cityMatch = (home.address || "").match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}\s*\d{5}/);
  const city = cityMatch?.[1]?.trim() || null;
  const stateMatch = (home.address || "").match(/,\s*([A-Z]{2})\s*\d{5}/);
  const state = stateMatch?.[1] || null;

  // Fetch data from both sources in parallel
  const rcPromise = process.env.RENTCAST_API_KEY
    ? fetchRentCastData(address, zipCode ?? undefined).catch((err) => ({
        property: null as RentCastProperty | null,
        avm: null as RentCastAVMResult | null,
        market: null as RentCastMarketStats | null,
        error: err instanceof Error ? err.message : "RentCast API error",
      }))
    : Promise.resolve({ property: null as RentCastProperty | null, avm: null as RentCastAVMResult | null, market: null as RentCastMarketStats | null, error: null as string | null });

  const srPromise = (process.env.SIMPLYRETS_USERNAME && process.env.SIMPLYRETS_PASSWORD)
    ? fetchSimplyRetsComps({
        city: city ?? undefined,
        postalCode: zipCode ?? undefined,
        state: state ?? undefined,
        beds: typeof home.beds === "number" ? home.beds : undefined,
        sqft: typeof home.sqft === "number" ? home.sqft : undefined,
        propertyType: home.property_type ?? undefined,
      }).catch((err) => {
        return { listings: [] as SimplyRetsListing[], error: err instanceof Error ? err.message : "SimplyRETS API error" };
      }).then((result) => Array.isArray(result) ? { listings: result, error: null as string | null } : result)
    : Promise.resolve({ listings: [] as SimplyRetsListing[], error: null as string | null });

  const [rcResult, srResult] = await Promise.all([rcPromise, srPromise]);

  const rentcastProperty = "error" in rcResult && rcResult.error ? null : rcResult.property;
  const rentcastAVM = "error" in rcResult && rcResult.error ? null : rcResult.avm;
  const rentcastMarket = "error" in rcResult && rcResult.error ? null : rcResult.market;
  const rentcastError = ("error" in rcResult ? rcResult.error : null) as string | null;
  const simplyRetsListings = srResult.listings;
  const simplyRetsError = srResult.error;

  // Use RentCast data to fill in subject property details (override scraped/null values)
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

  const userPrompt = buildUserPrompt({
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl,
    rentcastAVM, rentcastMarket, rentcastError,
    simplyRetsListings, simplyRetsError,
  });

  const hasRentCastComps = rentcastAVM && rentcastAVM.comparables?.length > 0;
  const hasMLSComps = simplyRetsListings.filter((l) => l.sales.closePrice && l.sales.closePrice > 0).length > 0;

  // Non-streaming mode
  if (!stream) {
    const anthropic = new Anthropic();
    let rawResponse: string;
    try {
      const message = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        return NextResponse.json({ error: "No text response from Claude" }, { status: 502 });
      }
      rawResponse = textBlock.text;
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Claude API call failed" }, { status: 502 });
    }

    let compsResult: CompsResult;
    try {
      const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      compsResult = JSON.parse(cleaned) as CompsResult;
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response as JSON", raw: rawResponse }, { status: 502 });
    }

    await supabase.from("candidate_comps").delete().eq("candidate_home_id", id);
    await supabase.from("candidate_comps").insert({
      candidate_home_id: id,
      comps: compsResult as unknown as Record<string, unknown>,
      price_estimate: compsResult.estimate?.trend_adjusted ?? null,
      price_range_low: compsResult.estimate?.range?.most_likely?.[0] ?? null,
      price_range_high: compsResult.estimate?.range?.most_likely?.[1] ?? null,
      market_temperature: compsResult.estimate?.market_temperature ?? null,
      reasoning: compsResult.reasoning ?? null,
      raw_response: rawResponse,
    });

    return NextResponse.json(compsResult);
  }

  // Streaming mode (SSE)
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const body = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream already closed
        }
      };

      try {
        send("log", { message: `Subject: ${address}` });
        send("log", { message: `Details: ${subjectBeds} bed / ${subjectBaths} bath / ${subjectSqft} sqft` });
        send("log", { message: `Listed at: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}` });

        // Data source status logs
        send("log", { message: "" });
        if (rentcastProperty) {
          send("log", { message: "RentCast: Subject property data loaded" });
          send("log", { message: `  Year Built: ${subjectYearBuilt} | Lot: ${typeof subjectLot === "number" ? subjectLot.toLocaleString() + " sqft" : subjectLot}` });
        }
        if (rentcastAVM) {
          send("log", { message: `RentCast: AVM estimate $${rentcastAVM.price.toLocaleString()} (${rentcastAVM.comparables.length} comps)` });
        }
        if (rentcastMarket) {
          send("log", { message: `RentCast: Market statistics loaded for zip ${zipCode}` });
        }
        if (rentcastError) {
          send("log", { message: `Warning: RentCast API: ${rentcastError}` });
        }

        const mlsCompCount = simplyRetsListings.filter((l) => l.sales.closePrice && l.sales.closePrice > 0).length;
        if (mlsCompCount > 0) {
          send("log", { message: `SimplyRETS: ${mlsCompCount} closed MLS listings loaded` });
        }
        if (simplyRetsError) {
          send("log", { message: `Warning: SimplyRETS: ${simplyRetsError}` });
        }
        if (!process.env.SIMPLYRETS_USERNAME) {
          send("log", { message: "SimplyRETS: Not configured (set SIMPLYRETS_USERNAME/PASSWORD)" });
        }

        if (!hasRentCastComps && !hasMLSComps) {
          send("log", { message: "Note: No external comp data — Claude will use training data" });
        }

        send("log", { message: "" });
        send("log", { message: `Connecting to Claude API (${model})...` });

        const anthropic = new Anthropic();
        let rawResponse = "";

        send("log", { message: "Streaming response from Claude..." });

        const sseStream = anthropic.messages.stream({
          model,
          max_tokens: 8192,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        }, { signal: abortController.signal });

        let tokenCount = 0;
        for await (const event of sseStream) {
          if (abortController.signal.aborted) {
            send("log", { message: "Analysis stopped by user" });
            send("done", {});
            controller.close();
            return;
          }

          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            rawResponse += event.delta.text;
            tokenCount += 1;
            send("token", { text: event.delta.text });
            if (tokenCount % 100 === 0) {
              send("log", { message: `Generating... (${tokenCount} tokens)` });
            }
          }
        }

        send("log", { message: `Response complete (${tokenCount} tokens)` });
        send("log", { message: "Parsing JSON response..." });

        let compsResult: CompsResult;
        try {
          const cleaned = rawResponse.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
          compsResult = JSON.parse(cleaned) as CompsResult;
        } catch {
          send("log", { message: "ERROR: Failed to parse Claude response as JSON" });
          send("error", { message: "Failed to parse response", raw: rawResponse.slice(0, 500) });
          send("done", {});
          controller.close();
          return;
        }

        const compsCount = compsResult.comps?.length ?? 0;
        send("log", { message: `Found ${compsCount} comparable sales` });

        if (compsResult.estimate) {
          send("log", { message: `Comp-based estimate: $${compsResult.estimate.comp_based?.toLocaleString()}` });
          send("log", { message: `Market temperature: ${compsResult.estimate.market_temperature}` });
          send("log", { message: `Trend-adjusted estimate: $${compsResult.estimate.trend_adjusted?.toLocaleString()}` });
        }

        send("log", { message: "" });
        send("log", { message: "Saving to cache..." });

        await supabase.from("candidate_comps").delete().eq("candidate_home_id", id);
        const { error: insertError } = await supabase.from("candidate_comps").insert({
          candidate_home_id: id,
          comps: compsResult as unknown as Record<string, unknown>,
          price_estimate: compsResult.estimate?.trend_adjusted ?? null,
          price_range_low: compsResult.estimate?.range?.most_likely?.[0] ?? null,
          price_range_high: compsResult.estimate?.range?.most_likely?.[1] ?? null,
          market_temperature: compsResult.estimate?.market_temperature ?? null,
          reasoning: compsResult.reasoning ?? null,
          raw_response: rawResponse,
        });

        if (insertError) {
          send("log", { message: `Warning: cache save failed (${insertError.message})` });
        } else {
          send("log", { message: "Cached successfully (expires in 7 days)" });
        }

        send("log", { message: "Done!" });
        send("result", compsResult);
        send("done", {});
      } catch (err) {
        if (abortController.signal.aborted) {
          send("log", { message: "Analysis stopped by user" });
        } else {
          const msg = err instanceof Error ? err.message : "Unknown error";
          send("log", { message: `ERROR: ${msg}` });
          send("error", { message: msg });
        }
        send("done", {});
      }

      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
