import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { CompsResult, RawComp, ScoredComp, ScrapeResult } from "@/lib/types";
import { scrapeComps } from "@/lib/redfin-scraper";
import { computeEstimate } from "@/lib/comps/pricing";
import { scoreComps, type SubjectGeo } from "@/lib/comps/similarity";
import { fetchPropertyFactsBatch, fetchPropertyFacts } from "@/lib/redfin-property-facts";
import { computeTrendFromComps, timeAdjustPrice } from "@/lib/comps/trend";

const TOP_N_FOR_PROMPT = 10;
/** Fetch property facts for top-K candidates + subject before scoring. */
const TOP_N_FOR_ENRICHMENT = 12;
/** Best-effort budget for the parallel fact-fetch step. */
const ENRICHMENT_BUDGET_MS = 8_000;

const VALID_MODELS = [
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;
type ValidModel = (typeof VALID_MODELS)[number];

const CACHE_DAYS = 7;

/** Extract JSON object from a Claude response that may contain markdown fences or surrounding text. */
function extractJSON(raw: string): unknown {
  // 1. Try parsing the raw string directly
  const trimmed = raw.trim();
  try { return JSON.parse(trimmed); } catch { /* continue */ }

  // 2. Strip markdown code fences (```json ... ``` or ``` ... ```)
  const fencePattern = /^`{3,}(?:json)?\s*\n?([\s\S]*?)\n?`{3,}\s*$/i;
  const fenceMatch = trimmed.match(fencePattern);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
  }

  // 3. Find the first { and last } — extract the outermost JSON object
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch { /* continue */ }

    // 4. Sometimes Claude puts unescaped newlines in string values — try fixing them
    const fixed = candidate.replace(/(?<=":.*"[^"]*)\n([^"]*")/g, "\\n$1");
    try { return JSON.parse(fixed); } catch { /* continue */ }
  }

  throw new Error("Failed to parse Claude response as JSON — no valid JSON object found");
}

/** Extract 5-digit zip code from an address string. */
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

/** Overwrite Claude's estimate fields with deterministic math computed from the returned comps. */
function applyDeterministicEstimate(
  result: CompsResult,
  subjectSqft: number,
): CompsResult {
  if (!result.comps?.length || !subjectSqft || subjectSqft <= 0) return result;

  const marketTemperature =
    result.estimate?.market_temperature ?? ("warm" as const);
  const explicitTrendPct =
    typeof result.estimate?.trend_adjustment_pct === "number"
      ? result.estimate.trend_adjustment_pct
      : undefined;

  // Use weighted median (robust to bimodal pools) and hybrid strategy
  // (lot value matters for small homes in this market).
  const estimate = computeEstimate({
    subjectSqft,
    subjectLotSqft: result.subject?.lot_sqft ?? null,
    comps: result.comps.map((c) => ({
      sold_price: c.sold_price,
      sqft: c.sqft,
      similarity_score: c.similarity_score,
      lot_sqft: c.lot_sqft,
    })),
    marketTemperature,
    trendPct: explicitTrendPct,
    strategy: "hybrid",
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

CRITICAL: Your entire response must be ONLY the raw JSON object. Start your response with { and end with }. Do NOT wrap in markdown code fences (no \`\`\`). Do NOT include any text before or after the JSON.

=== YOUR TASK ===
1. Read the subject property details and the pre-scored comp list (10 comps, ranked by total_score).
2. Pick the BEST 8 of those 10 to include in the report. Use your judgment — usually the top 8 by total_score, but you may demote one for an obvious red flag (e.g., flip with extreme reno premium, atypical layout) and promote a lower-ranked comp in its place. Briefly note any swap in the "reasoning" field.
3. For each of the 8 chosen comps, write a one-sentence "reason" explaining why it's relevant (e.g., "Same block, similar 1950s ranch layout, sold a month ago").
4. Classify the local market temperature ("hot" / "warm" / "cool") based on your knowledge of the area at the listed sold-date range.
5. Estimate market_signals (sale_to_list_ratio, days_on_market, yoy_change, mom_change) as best-effort summary strings — these are narrative, not used in math.
6. Write a 2-3 sentence "reasoning" that summarizes the comp set, what's driving the spread of $/sqft, and any caveats (renovation premium, location tier difference, sparse data, etc.).

DO NOT recompute similarity, recency, distance, or any score — use the values provided. DO NOT compute price estimates, weighted averages, or ranges — the application does those deterministically from your selected comps.

=== OUTPUT SCHEMA ===
CompsResult:
{
  "comps": [CompHome, ...],          // EXACTLY 8 comps from the provided list of 10
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

Pick the BEST 8 of the ${scoredComps.length} comps above. Default to the top 8 by total_score; only swap in a lower-ranked comp if there's a clear judgment reason (which you must note in "reasoning"). Use the numeric values verbatim — do not recompute. Write a one-sentence "reason" per comp and a short overall "reasoning" summary.`;
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
  let scrapeResult: ScrapeResult = { comps: [], source: "claude-knowledge" };
  const scrapeLog = (msg: string) => console.log(`[Scraper] ${msg}`);

  if (zip) {
    scrapeResult = await scrapeComps(zip, scrapeLog);
  } else {
    console.log("[Scraper] Warning: no zip code found in address, skipping scrape");
  }

  // --- Pre-score comps deterministically (1A + 1C/1D enrichment, 2D trend) ---
  let scoredComps: ScoredComp[] = [];
  let enrichedSubject: SubjectGeo | null = null;
  let monthlyDriftPct = 0;
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

          // 2D — compute trend from the (full, unenriched) pool. Strict gating means it usually returns 0.
          const trend = computeTrendFromComps(scrapeResult.comps, new Date(), 12);
          monthlyDriftPct = trend.monthly_drift_pct;

          // Time-adjust comp prices when trend is non-zero.
          const adjustedPool: RawComp[] =
            monthlyDriftPct !== 0
              ? enrichedPool.map((c) => ({
                  ...c,
                  sold_price: timeAdjustPrice(c.sold_price, c.sold_date, new Date(), monthlyDriftPct),
                }))
              : enrichedPool;

          const finalScored = scoreComps(subjectGeo, adjustedPool, new Date());
          scoredComps = finalScored.slice(0, TOP_N_FOR_PROMPT);
          enrichedSubject = subjectGeo;
        } else {
          console.log("[Enrichment] Budget exceeded — proceeding with base scoring");
          scoredComps = baseScored.slice(0, TOP_N_FOR_PROMPT);
          enrichedSubject = subjectGeo;
        }
      } catch (err) {
        console.log(
          `[Enrichment] Failed: ${err instanceof Error ? err.message : String(err)} — proceeding with base scoring`,
        );
        scoredComps = baseScored.slice(0, TOP_N_FOR_PROMPT);
        enrichedSubject = subjectGeo;
      }

      console.log(
        `[Scoring] ${baseScored.length} comps in window, enrichment ${enrichmentInfo.fetched}/${enrichmentInfo.attempted} in ${enrichmentInfo.ms}ms, top ${scoredComps.length} sent to Claude (trend ${monthlyDriftPct.toFixed(2)}%/mo)`,
      );
    } else {
      console.log("[Scoring] Subject sqft unknown — falling back to unscored prompt");
    }
  }
  void enrichedSubject; // reserved for future use

  // Build prompt: pre-scored comps if scoring succeeded, otherwise Claude knowledge (unverified)
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
      compsResult = extractJSON(rawResponse) as CompsResult;
    } catch {
      return NextResponse.json({ error: "Failed to parse Claude response as JSON", raw: rawResponse }, { status: 502 });
    }

    compsResult = applyDeterministicEstimate(
      compsResult,
      typeof subjectSqft === "number" ? subjectSqft : compsResult.subject?.sqft ?? 0,
    );

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
          if (monthlyDriftPct !== 0) {
            send("log", { message: `Market trend (data-driven): ${monthlyDriftPct >= 0 ? "+" : ""}${monthlyDriftPct.toFixed(2)}%/mo — comp prices time-adjusted` });
          }
          send("log", { message: `Pre-scored top ${scoredComps.length} sent to Claude` });
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
          send("log", { message: "Pre-scoring skipped (subject sqft unknown) — Claude will rank using its knowledge" });
        } else {
          send("log", { message: "Data source: Claude knowledge (unverified) — scraping unavailable" });
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
          compsResult = extractJSON(rawResponse) as CompsResult;
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
        );

        if (compsResult.estimate) {
          send("log", { message: `Computed estimate from ${compsCount} comps (deterministic)` });
          send("log", { message: `Weighted $/sqft: $${compsResult.estimate.weighted_price_per_sqft?.toLocaleString()}` });
          send("log", { message: `Comp-based estimate: $${compsResult.estimate.comp_based?.toLocaleString()}` });
          send("log", { message: `Market temperature: ${compsResult.estimate.market_temperature} (${compsResult.estimate.trend_adjustment_pct >= 0 ? "+" : ""}${compsResult.estimate.trend_adjustment_pct}%)` });
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
