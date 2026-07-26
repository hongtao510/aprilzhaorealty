import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import type { CompsResult, RawComp, ScoredComp, ScrapeResult } from "@/lib/types";
import { scrapeComps } from "@/lib/redfin-scraper";
import {
  computeEstimate,
  PRICING_METHOD_VERSION,
  type PricingComp,
} from "@/lib/comps/pricing";
import { haversineMiles, scoreComps, type SubjectGeo } from "@/lib/comps/similarity";
import { fetchPropertyFactsBatch, fetchPropertyFacts } from "@/lib/redfin-property-facts";

const TOP_N_FOR_PROMPT = 20;
/** Fetch property facts for top-K candidates + subject before scoring. */
const TOP_N_FOR_ENRICHMENT = 12;
/** Best-effort budget for the parallel fact-fetch step. */
const ENRICHMENT_BUDGET_MS = 8_000;

const VALID_MODELS = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
] as const;
type ValidModel = (typeof VALID_MODELS)[number];

const CACHE_DAYS = 7;

const COMPS_RESPONSE_FORMAT = {
  type: "json_schema" as const,
  name: "comps_result",
  description: "A comparative market analysis based on the supplied subject and comparable sales.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      comps: {
        type: "array",
        minItems: 1,
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            address: { type: "string" },
            sold_price: { type: "number" },
            sold_date: { type: "string" },
            sqft: { type: "number" },
            beds: { type: "number" },
            baths: { type: "number" },
            lot_sqft: { type: "number" },
            similarity_score: { type: "number" },
            price_per_sqft: { type: "number" },
            reason: { type: "string" },
            redfin_url: { type: "string" },
            distance_miles: { type: "number" },
          },
          required: [
            "address",
            "sold_price",
            "sold_date",
            "sqft",
            "beds",
            "baths",
            "lot_sqft",
            "similarity_score",
            "price_per_sqft",
            "reason",
            "redfin_url",
            "distance_miles",
          ],
        },
      },
      subject: {
        type: "object",
        additionalProperties: false,
        properties: {
          address: { type: "string" },
          sqft: { type: "number" },
          beds: { type: "number" },
          baths: { type: "number" },
          lot_sqft: { type: "number" },
        },
        required: ["address", "sqft", "beds", "baths", "lot_sqft"],
      },
      estimate: {
        type: "object",
        additionalProperties: false,
        properties: {
          market_temperature: {
            type: "string",
            enum: ["hot", "warm", "cool"],
          },
        },
        required: ["market_temperature"],
      },
      market_signals: {
        type: "object",
        additionalProperties: false,
        properties: {
          sale_to_list_ratio: { type: "string" },
          days_on_market: { type: "number" },
          yoy_change: { type: "string" },
          mom_change: { type: "string" },
        },
        required: [
          "sale_to_list_ratio",
          "days_on_market",
          "yoy_change",
          "mom_change",
        ],
      },
      reasoning: { type: "string" },
    },
    required: ["comps", "subject", "estimate", "market_signals", "reasoning"],
  },
};

/** Extract 5-digit zip code from an address string. */
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/** Extract the city portion of a "Street, City, ST ZIP" formatted address. */
function extractCity(address: string): string | null {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  // Expect "[Street, City, ST ZIP]" — city is the second-to-last when state+zip are joined,
  // OR the second when there are 3+ comma-separated parts.
  if (parts.length >= 3) return parts[parts.length - 2];
  if (parts.length === 2) return parts[1].replace(/\s+(CA|California)\s+\d{5}.*$/i, "").trim() || null;
  return null;
}

/** Map a ScoredComp into the wire-friendly CompHomeWithGeo shape used by the UI map picker. */
function toCandidate(c: ScoredComp): import("@/lib/types").CompHomeWithGeo {
  return {
    address: c.address,
    zip_code: c.zip_code ?? extractZip(c.address),
    sold_price: c.sold_price,
    sold_date: c.sold_date,
    sqft: c.sqft,
    beds: c.beds,
    baths: c.baths,
    lot_sqft: c.lot_sqft ?? 0,
    similarity_score: c.total_score,
    price_per_sqft: c.price_per_sqft,
    reason: "",
    redfin_url: c.redfin_url,
    distance_miles: c.distance_known ? c.distance_miles : undefined,
    latitude: c.latitude ?? null,
    longitude: c.longitude ?? null,
    city: c.city ?? null,
    total_score: c.total_score,
    year_built: c.year_built ?? null,
    neighborhood: c.neighborhood ?? null,
    elementary_school_rating: c.elementary_school_rating ?? null,
    renovation_tier: c.renovation_tier ?? null,
  };
}

function buildMarketPricingComps(comps: RawComp[], subject: SubjectGeo): PricingComp[] {
  return comps.map((c) => ({
    address: c.address,
    zip_code: c.zip_code ?? extractZip(c.address),
    sold_price: c.sold_price,
    sold_date: c.sold_date,
    sqft: c.sqft,
    similarity_score: 1,
    distance_miles:
      subject.latitude != null &&
      subject.longitude != null &&
      c.latitude != null &&
      c.longitude != null
        ? haversineMiles(
            { lat: subject.latitude, lng: subject.longitude },
            { lat: c.latitude, lng: c.longitude },
          )
        : undefined,
    lot_sqft: c.lot_sqft,
  }));
}

/** Overwrite the model's estimate fields with deterministic math computed from the returned comps. */
function applyDeterministicEstimate(
  result: CompsResult,
  subjectSqft: number,
  subjectZip: string | null,
  marketComps: PricingComp[],
): CompsResult {
  if (!result.comps?.length || !subjectSqft || subjectSqft <= 0) return result;

  const marketTemperature =
    result.estimate?.market_temperature ?? ("warm" as const);
  const estimate = computeEstimate({
    subjectSqft,
    subjectLotSqft: result.subject?.lot_sqft ?? null,
    comps: result.comps.map((c) => ({
      address: c.address,
      sold_price: c.sold_price,
      sold_date: c.sold_date,
      sqft: c.sqft,
      similarity_score: c.similarity_score,
      distance_miles: c.distance_miles,
      lot_sqft: c.lot_sqft,
    })),
    marketComps,
    subjectZip,
    marketTemperature,
    strategy: "median",
  });

  return { ...result, estimate };
}

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

const SYSTEM_PROMPT = `You are a real estate Comparative Market Analysis (CMA) expert. The application has already done the math: it scraped real recently-sold comps from the MLS via Redfin, and computed every numeric similarity, distance, and recency score deterministically. Your job is to add the human judgment on top.

=== YOUR TASK ===
1. Read the subject property details and the pre-scored comp list, ranked by total_score.
2. Pick up to the BEST 8 provided comps to include in the report. If fewer than 8 are provided, use all of them and never invent another comp. Use your judgment — usually the top comps by total_score, but you may demote one for an obvious red flag (e.g., flip with extreme renovation premium, atypical layout) and promote a lower-ranked comp in its place. Briefly note any swap in the "reasoning" field.
3. For each chosen comp, write a one-sentence "reason" explaining why it's relevant (e.g., "Same block, similar 1950s ranch layout, sold a month ago").
4. Classify the local market temperature ("hot" / "warm" / "cool") based on your knowledge of the area at the listed sold-date range.
5. Estimate market_signals (sale_to_list_ratio, days_on_market, yoy_change, mom_change) as best-effort summary strings — these are narrative, not used in math.
6. Write a 2-3 sentence "reasoning" that summarizes the comp set, what's driving the spread of $/sqft, and any caveats (renovation premium, location tier difference, sparse data, etc.).

DO NOT recompute similarity, recency, distance, or any score — use the values provided. DO NOT compute price estimates, weighted averages, or ranges — the application does those deterministically from your selected comps.

=== OUTPUT SCHEMA ===
CompsResult:
{
  "comps": [CompHome, ...],          // Up to 8 comps from the provided list
  "subject": { "address": string, "sqft": number, "beds": number, "baths": number, "lot_sqft": number },
  "estimate": {
    "market_temperature": "hot" | "warm" | "cool"
  },
  "market_signals": {
    "sale_to_list_ratio": string,
    "days_on_market": number,
    "yoy_change": string,
    "mom_change": string
  },
  "reasoning": string
}

CompHome (copy numeric fields verbatim from the provided comp; only "reason" is yours to write):
{
  "address": string,
  "sold_price": number,
  "sold_date": string,              // YYYY-MM-DD
  "sqft": number,
  "beds": number,
  "baths": number,
  "lot_sqft": number,
  "similarity_score": number,        // use the total_score from the provided comp
  "price_per_sqft": number,
  "reason": string,                  // your one-sentence narrative
  "redfin_url": string,
  "distance_miles": number
}`;

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
}) {
  const {
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl,
  } = opts;

  const today = new Date().toISOString().split("T")[0];

  let prompt = `Today's date is ${today}. Use this to calculate recency (months_ago) for each comp.

Perform a CMA for this subject property:

Address: ${address}
Property Type: ${propertyType}
List Price: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}
Square Feet: ${subjectSqft}
Bedrooms: ${subjectBeds}
Bathrooms: ${subjectBaths}
Lot Size: ${typeof subjectLot === "number" ? `${subjectLot.toLocaleString()} sqft` : subjectLot}
Year Built: ${subjectYearBuilt}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}

Find comparable recently sold homes in this area using your knowledge. Use ACTUAL SOLD prices only — do not use listing prices.`;

  const hasUnknowns = [subjectSqft, subjectBeds, subjectBaths, subjectLot].some(
    (v) => v === "Unknown" || v === null
  );

  if (hasUnknowns) {
    prompt += `

IMPORTANT: Some property details above are "Unknown". You MUST research the correct details for this property based on the address. The "subject" field in your response MUST contain the correct values.`;
  }

  prompt += `

Score each comp using the similarity formula with recency adjustment, rank by total_score (recency-adjusted), select the top 8, and produce the CompsResult JSON. Exclude comps older than 12 months entirely. Remember to IGNORE the listing price when computing the price estimate.`;

  return prompt;
}

function buildVerifiedCompsPrompt(opts: {
  address: string;
  price: string | number;
  subjectBeds: number | string;
  subjectBaths: number | string;
  subjectSqft: number | string;
  subjectLot: number | string;
  subjectYearBuilt: number | string;
  propertyType: string;
  sourceUrl: string | null;
  scoredComps: ScoredComp[];
  scrapeSource: string;
}) {
  const {
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl, scoredComps, scrapeSource,
  } = opts;

  const today = new Date().toISOString().split("T")[0];
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const compsTable = scoredComps
    .map(
      (c, i) =>
        `${i + 1}. ${c.address}
   sold: $${fmt(c.sold_price)} on ${c.sold_date} | ${c.beds}bd/${c.baths}ba | ${fmt(c.sqft)} sqft | $${Math.round(c.price_per_sqft)}/sf${c.lot_sqft ? ` | lot ${fmt(c.lot_sqft)} sqft` : ""}
   total_score: ${c.total_score.toFixed(3)} | similarity ${c.similarity.toFixed(3)} | recency ${c.recency.toFixed(2)} | distance ${c.distance_miles.toFixed(2)}mi | tier ${c.tier_score.toFixed(2)}${c.redfin_url ? `\n   url: ${c.redfin_url}` : ""}`,
    )
    .join("\n");

  return `Today's date is ${today}. Use this to calculate recency (months_ago) for each comp.

Perform a CMA for this subject property:

Address: ${address}
Property Type: ${propertyType}
List Price: ${typeof price === "number" ? `$${fmt(price)}` : price}
Square Feet: ${subjectSqft}
Bedrooms: ${subjectBeds}
Bathrooms: ${subjectBaths}
Lot Size: ${typeof subjectLot === "number" ? `${fmt(subjectLot)} sqft` : subjectLot}
Year Built: ${subjectYearBuilt}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}

=== PRE-SCORED COMPS (top ${scoredComps.length} of recently sold homes from Redfin via ${scrapeSource}) ===
These comps were retrieved from real MLS data and scored deterministically by the application. The total_score combines size, bed+bath, lot, distance, neighborhood-tier, and recency factors.

${compsTable}

Pick up to the BEST 8 of the ${scoredComps.length} comps above. If fewer than 8 are provided, use all of them and do not invent additional comps. Default to the top 8 by total_score; only swap in a lower-ranked comp if there's a clear judgment reason (which you must note in "reasoning"). Use the numeric values verbatim — do not recompute. Write a one-sentence "reason" per comp and a short overall "reasoning" summary.`;
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
  const modelParam = searchParams.get("model") || "gpt-5.6-terra";
  /** "candidates" = Phase 1: scrape + score + enrich, return { candidates, subject } without calling OpenAI. */
  const mode = searchParams.get("mode") === "candidates" ? "candidates" : "full";
  /** Comma-separated Redfin URLs the user picked in the map UI; if present, restrict the model's input to those. */
  const selectedUrlsRaw = searchParams.get("selectedUrls");
  const selectedUrlSet = selectedUrlsRaw
    ? new Set(selectedUrlsRaw.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  if (!VALID_MODELS.includes(modelParam as ValidModel)) {
    return NextResponse.json(
      { error: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` },
      { status: 400 }
    );
  }
  const model = modelParam as ValidModel;
  const baseRequest = {
    model,
    instructions: SYSTEM_PROMPT,
    max_output_tokens: 12_000,
    reasoning: { effort: "medium" as const },
    store: false,
    text: { format: COMPS_RESPONSE_FORMAT },
  };

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
  // mode=candidates and a user-selected subset both bypass the cache — the cached result was
  // computed against a different (or default) selection.
  const skipCache = force || mode === "candidates" || (selectedUrlSet && selectedUrlSet.size > 0);
  if (!skipCache) {
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

    const cachedResult = cached?.comps as CompsResult | undefined;
    const isCurrentPricingMethod =
      cachedResult?.estimate?.pricing_methodology?.version === PRICING_METHOD_VERSION;
    if (cached && isCurrentPricingMethod) {
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
  if (!process.env.OPENAI_API_KEY) {
    const msg = "OPENAI_API_KEY is not set in .env.local";
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

  const address = home.address || home.title || "Unknown address";
  const price = home.price || home.price_numeric || "Unknown";
  const sourceUrl = home.url || null;

  const subjectBeds = home.beds ?? "Unknown";
  const subjectBaths = home.baths ?? "Unknown";
  const subjectSqft = home.sqft ?? "Unknown";
  const subjectLot = home.lot_sqft ?? "Unknown";
  const subjectYearBuilt = home.year_built ?? "Unknown";
  const propertyType = home.property_type ?? "Single Family";

  // --- Scrape real comp data (before streaming/non-streaming branch) ---
  const zip = extractZip(address);
  let scrapeResult: ScrapeResult = { comps: [], source: "model-knowledge" };
  const scrapeLog = (msg: string) => console.log(`[Scraper] ${msg}`);

  if (zip) {
    scrapeResult = await scrapeComps(zip, scrapeLog);
  } else {
    console.log("[Scraper] Warning: no zip code found in address, skipping scrape");
  }

  // --- Pre-score comps deterministically (1A + 1C/1D enrichment, 2D trend) ---
  let scoredComps: ScoredComp[] = [];
  let candidatesForUI: ScoredComp[] = [];
  let marketCompsForPricing: PricingComp[] = [];
  let enrichedSubject: SubjectGeo | null = null;
  const enrichmentInfo = { attempted: 0, fetched: 0, ms: 0 };
  if (scrapeResult.comps.length > 0) {
    const subjectGeo: SubjectGeo = {
      sqft: typeof subjectSqft === "number" ? subjectSqft : 0,
      beds: typeof subjectBeds === "number" ? subjectBeds : 0,
      baths: typeof subjectBaths === "number" ? subjectBaths : 0,
      lot_sqft: typeof subjectLot === "number" ? subjectLot : null,
      latitude: typeof home.latitude === "number" ? home.latitude : null,
      longitude: typeof home.longitude === "number" ? home.longitude : null,
      property_type: typeof home.property_type === "string" ? home.property_type : null,
      year_built: typeof home.year_built === "number" ? home.year_built : null,
      city: extractCity(address),
    };

    if (subjectGeo.sqft > 0) {
      // First pass: rank by base similarity (no facts) to pick the top candidates worth enriching.
      const baseScored = scoreComps(subjectGeo, scrapeResult.comps, new Date());
      const enrichmentTargets = baseScored.slice(0, TOP_N_FOR_ENRICHMENT);

      // Best-effort enrichment with budget — fetch facts for subject + top candidates in parallel.
      const t0 = Date.now();
      const urls = enrichmentTargets
        .map((c) => c.redfin_url)
        .filter((u): u is string => !!u);
      enrichmentInfo.attempted = urls.length + (home.url ? 1 : 0);

      try {
        const enrichmentPromise = Promise.all([
          fetchPropertyFactsBatch(urls, 4),
          home.url ? fetchPropertyFacts(home.url) : Promise.resolve(null),
        ]);
        const enrichmentResult = await Promise.race([
          enrichmentPromise,
          new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), ENRICHMENT_BUDGET_MS),
          ),
        ]);

        if (enrichmentResult) {
          const [factsByUrl, subjectFacts] = enrichmentResult;
          enrichmentInfo.fetched = factsByUrl.size + (subjectFacts ? 1 : 0);
          enrichmentInfo.ms = Date.now() - t0;

          if (subjectFacts) {
            subjectGeo.neighborhood = subjectFacts.neighborhood;
            subjectGeo.elementary_school_rating = subjectFacts.elementary_school_rating;
            subjectGeo.renovation_tier = subjectFacts.renovation_tier;
            // Fallback geocoding: if the candidate_homes row didn't have lat/lng, lift them from the
            // Redfin property page so the map can plot the red Target Home pin.
            if (subjectGeo.latitude == null && subjectFacts.latitude != null) {
              subjectGeo.latitude = subjectFacts.latitude;
            }
            if (subjectGeo.longitude == null && subjectFacts.longitude != null) {
              subjectGeo.longitude = subjectFacts.longitude;
            }
          }

          // Enrich the raw comp pool with facts (only those in the top candidates we fetched).
          const enrichedPool: RawComp[] = scrapeResult.comps.map((c) => {
            const f = factsByUrl.get(c.redfin_url);
            return f
              ? {
                  ...c,
                  neighborhood: f.neighborhood,
                  elementary_school_rating: f.elementary_school_rating,
                  renovation_tier: f.renovation_tier,
                }
              : c;
          });

          const finalScored = scoreComps(subjectGeo, enrichedPool, new Date());
          scoredComps = finalScored.slice(0, TOP_N_FOR_PROMPT);
          candidatesForUI = finalScored.slice(0, 30);
          marketCompsForPricing = buildMarketPricingComps(enrichedPool, subjectGeo);
          enrichedSubject = subjectGeo;
        } else {
          console.log("[Enrichment] Budget exceeded — proceeding with base scoring");
          scoredComps = baseScored.slice(0, TOP_N_FOR_PROMPT);
          candidatesForUI = baseScored.slice(0, 30);
          marketCompsForPricing = buildMarketPricingComps(scrapeResult.comps, subjectGeo);
          enrichedSubject = subjectGeo;
        }
      } catch (err) {
        console.log(
          `[Enrichment] Failed: ${err instanceof Error ? err.message : String(err)} — proceeding with base scoring`,
        );
        scoredComps = baseScored.slice(0, TOP_N_FOR_PROMPT);
        candidatesForUI = baseScored.slice(0, 30);
        marketCompsForPricing = buildMarketPricingComps(scrapeResult.comps, subjectGeo);
        enrichedSubject = subjectGeo;
      }

      console.log(
        `[Scoring] ${baseScored.length} comps in window, enrichment ${enrichmentInfo.fetched}/${enrichmentInfo.attempted} in ${enrichmentInfo.ms}ms, top ${scoredComps.length} sent to OpenAI`,
      );
    } else {
      console.log("[Scoring] Subject sqft unknown — falling back to unscored prompt");
    }
  }
  // Phase 1: candidates-only — return the scored pool + subject geo for the map picker, no LLM call.
  if (mode === "candidates") {
    return NextResponse.json({
      candidates: candidatesForUI.map(toCandidate),
      pricing_market_comps: marketCompsForPricing,
      subject: {
        address,
        sqft: typeof subjectSqft === "number" ? subjectSqft : 0,
        beds: typeof subjectBeds === "number" ? subjectBeds : 0,
        baths: typeof subjectBaths === "number" ? subjectBaths : 0,
        lot_sqft: typeof subjectLot === "number" ? subjectLot : 0,
        latitude: enrichedSubject?.latitude ?? null,
        longitude: enrichedSubject?.longitude ?? null,
        city: enrichedSubject?.city ?? null,
      },
      scrape_source: scrapeResult.source,
      enrichment: enrichmentInfo,
    });
  }

  // Phase 2: if the user selected a specific subset on the map, restrict the model's input to that set
  // (preserve the user's selection order so the LLM sees them ranked the same way they were chosen).
  if (selectedUrlSet && selectedUrlSet.size > 0) {
    // Phase 1 exposes more candidates than the normal prompt pool. Always filter
    // that wider set so a checked lower-ranked row is never silently ignored.
    const selectedCandidates = candidatesForUI.filter(
      (c) => c.redfin_url && selectedUrlSet.has(c.redfin_url),
    );
    if (selectedCandidates.length > 0) scoredComps = selectedCandidates;
    // A manual selection is an explicit pricing decision. Restrict the
    // deterministic market pool as well as the model prompt so the final report
    // matches the live estimate shown beside the checkboxes.
    if (enrichedSubject && scoredComps.length > 0) {
      marketCompsForPricing = buildMarketPricingComps(scoredComps, enrichedSubject);
    }
    console.log(`[Scoring] User-selected subset: ${scoredComps.length} comps`);
  }

  // Build prompt: pre-scored comps if scoring succeeded, otherwise model knowledge (unverified)
  const userPrompt =
    scoredComps.length > 0
      ? buildVerifiedCompsPrompt({
          address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
          subjectYearBuilt, propertyType, sourceUrl,
          scoredComps,
          scrapeSource: scrapeResult.source,
        })
      : buildUserPrompt({
          address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
          subjectYearBuilt, propertyType, sourceUrl,
        });

  // Non-streaming mode
  if (!stream) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let rawResponse: string;
    try {
      const response = await openai.responses.create({
        ...baseRequest,
        input: userPrompt,
      });
      rawResponse = response.output_text;
      if (!rawResponse) {
        return NextResponse.json({ error: "No structured response from OpenAI" }, { status: 502 });
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "OpenAI API call failed" }, { status: 502 });
    }

    let compsResult: CompsResult;
    try {
      compsResult = JSON.parse(rawResponse) as CompsResult;
    } catch {
      return NextResponse.json({ error: "Failed to parse OpenAI structured response", raw: rawResponse }, { status: 502 });
    }

    compsResult = applyDeterministicEstimate(
      compsResult,
      typeof subjectSqft === "number" ? subjectSqft : compsResult.subject?.sqft ?? 0,
      zip,
      marketCompsForPricing,
    );
    if (candidatesForUI.length > 0) {
      compsResult = { ...compsResult, candidates: candidatesForUI.map(toCandidate) };
    }
    if (enrichedSubject) {
      compsResult = {
        ...compsResult,
        subject: {
          ...compsResult.subject,
          latitude: enrichedSubject.latitude,
          longitude: enrichedSubject.longitude,
          city: enrichedSubject.city ?? null,
        },
      };
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

        if (scoredComps.length > 0) {
          send("log", { message: `Data source: ${scrapeResult.comps.length} verified comps from ${scrapeResult.source}` });
          if (enrichmentInfo.attempted > 0) {
            send("log", { message: `Enriched ${enrichmentInfo.fetched}/${enrichmentInfo.attempted} listings with neighborhood/school/renovation facts (${enrichmentInfo.ms}ms)` });
          }
          send("log", { message: `Pre-scored top ${scoredComps.length} sent to OpenAI` });
          const top3 = scoredComps.slice(0, 3);
          for (const c of top3) {
            const tags: string[] = [];
            if (c.neighborhood) tags.push(c.neighborhood);
            if (c.elementary_school_rating != null) tags.push(`school ${c.elementary_school_rating}/10`);
            if (c.renovation_tier != null) tags.push(`reno-tier ${c.renovation_tier}`);
            send("log", { message: `  • ${c.address.slice(0, 48)} — score ${c.total_score.toFixed(2)} (${c.distance_miles.toFixed(2)}mi)${tags.length ? " | " + tags.join(", ") : ""}` });
          }
        } else if (scrapeResult.comps.length > 0) {
          send("log", { message: `Data source: ${scrapeResult.comps.length} verified comps from ${scrapeResult.source}` });
          send("log", { message: "Pre-scoring skipped (subject sqft unknown) — OpenAI will rank using model knowledge" });
        } else {
          send("log", { message: "Data source: model knowledge (unverified) — scraping unavailable" });
        }

        send("log", { message: "" });
        send("log", { message: `Connecting to OpenAI API (${model})...` });

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        let rawResponse = "";

        send("log", { message: "Streaming structured response from OpenAI..." });

        const openaiStream = await openai.responses.create({
          ...baseRequest,
          input: userPrompt,
          stream: true,
        }, { signal: abortController.signal });

        let chunkCount = 0;
        for await (const event of openaiStream) {
          if (abortController.signal.aborted) {
            send("log", { message: "Analysis stopped by user" });
            send("done", {});
            controller.close();
            return;
          }

          if (event.type === "response.output_text.delta") {
            rawResponse += event.delta;
            chunkCount += 1;
            send("token", { text: event.delta });
            if (chunkCount % 100 === 0) {
              send("log", { message: `Generating... (${chunkCount} chunks)` });
            }
          } else if (event.type === "response.failed") {
            throw new Error(event.response.error?.message ?? "OpenAI response failed");
          } else if (event.type === "response.incomplete") {
            throw new Error(
              `OpenAI response incomplete: ${event.response.incomplete_details?.reason ?? "unknown reason"}`,
            );
          }
        }

        send("log", { message: `Response complete (${chunkCount} chunks)` });
        send("log", { message: "Parsing JSON response..." });

        let compsResult: CompsResult;
        try {
          compsResult = JSON.parse(rawResponse) as CompsResult;
        } catch (parseErr) {
          const parseMsg = parseErr instanceof Error ? parseErr.message : "Invalid JSON";
          send("log", { message: `ERROR: ${parseMsg}` });
          send("log", { message: `Raw response (first 500 chars): ${rawResponse.slice(0, 500)}` });
          send("error", { message: parseMsg, raw: rawResponse.slice(0, 500) });
          send("done", {});
          controller.close();
          return;
        }

        const compsCount = compsResult.comps?.length ?? 0;
        send("log", { message: `Found ${compsCount} comparable sales` });

        compsResult = applyDeterministicEstimate(
          compsResult,
          typeof subjectSqft === "number" ? subjectSqft : compsResult.subject?.sqft ?? 0,
          zip,
          marketCompsForPricing,
        );
        if (candidatesForUI.length > 0) {
          compsResult = { ...compsResult, candidates: candidatesForUI.map(toCandidate) };
        }
        if (enrichedSubject) {
          compsResult = {
            ...compsResult,
            subject: {
              ...compsResult.subject,
              latitude: enrichedSubject.latitude,
              longitude: enrichedSubject.longitude,
              city: enrichedSubject.city ?? null,
            },
          };
        }

        if (compsResult.estimate) {
          send("log", { message: `Computed estimate from ${compsCount} comps (deterministic)` });
          const method = compsResult.estimate.pricing_methodology;
          send("log", { message: `Nearby baseline: ${method?.nearby_transaction_count ?? 0} sales within 0.5mi at $${compsResult.estimate.weighted_price_per_sqft?.toLocaleString()}/sqft` });
          send("log", { message: `Current ZIP signal: ${method?.recent_zip_transaction_count ?? 0} sales in 14 days (${method?.recent_zip_weight_pct ?? 0}% weight)` });
          send("log", { message: `Current-market estimate: $${compsResult.estimate.trend_adjusted?.toLocaleString()}` });
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
