import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { CompsResult, RawComp, ScrapeResult } from "@/lib/types";
import { scrapeComps } from "@/lib/redfin-scraper";

const VALID_MODELS = [
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

const SYSTEM_PROMPT = `You are a real estate Comparative Market Analysis (CMA) expert. You will receive a subject property and must produce a structured CMA report using your knowledge of recent comparable sales in the area.

CRITICAL: Your entire response must be ONLY the raw JSON object. Start your response with { and end with }. Do NOT wrap in markdown code fences (no \`\`\`). Do NOT include any text before or after the JSON.

=== YOUR TASK ===
1. You will receive the subject property details
2. Find comparable recently sold homes in the area using your knowledge
3. Score each comp, select the top 8, compute a price estimate, and produce the JSON output

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
  if months_ago <= 3:  recency_multiplier = 1.00
  if months_ago <= 6:  recency_multiplier = 0.95
  if months_ago <= 9:  recency_multiplier = 0.85
  if months_ago <= 12: recency_multiplier = 0.70

  total_score = similarity_score * recency_multiplier

Comps older than 12 months: EXCLUDE entirely.

Tie-breaking: more recent sale date wins, then closer distance wins.

=== PRICE ESTIMATION ===
1. IGNORE the subject property's listing price — it can be misleading
2. For each comp: price_per_sqft = comp_sold_price / comp_sqft
3. Weighted average: estimated_price_per_sqft = sum(comp_price_per_sqft * comp_score) / sum(comp_scores)
4. comp_based = estimated_price_per_sqft * subject_sqft
5. Round estimate to nearest $1,000

=== MARKET TREND ADJUSTMENT ===
Classify market temperature based on your knowledge of the local market:
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
  "comps": [CompHome, ...],          // top 8 comparable recently-sold homes
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
  "sold_date": string,              // YYYY-MM-DD
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
  scrapedComps: RawComp[];
  scrapeSource: string;
}) {
  const {
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl, scrapedComps, scrapeSource,
  } = opts;

  const today = new Date().toISOString().split("T")[0];
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const compsTable = scrapedComps
    .map((c, i) =>
      `${i + 1}. ${c.address} | Sold: $${fmt(c.sold_price)} on ${c.sold_date || "unknown"} | ${c.beds}bd/${c.baths}ba | ${fmt(c.sqft)} sqft${c.lot_sqft ? ` | Lot: ${fmt(c.lot_sqft)} sqft` : ""}${c.redfin_url ? ` | ${c.redfin_url}` : ""}`
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

=== VERIFIED RECENTLY SOLD COMPS (scraped from Redfin via ${scrapeSource}) ===
The following comps have VERIFIED sold prices from Redfin. Use ONLY these comps for your analysis.
Do NOT invent or add additional comps. These prices are real transaction data.

${compsTable}

Score each comp using the similarity formula with recency adjustment, rank by total_score (recency-adjusted), select the top 8, and produce the CompsResult JSON. Exclude comps older than 12 months entirely. Remember to IGNORE the listing price when computing the price estimate.

For any comp where lot_sqft is not available, use 0 for the lot_sqft field and reduce the lot_size weight to 0, redistributing its 20% weight equally to the other two criteria (house size becomes 60%, bed+bath becomes 40%).

For the distance_miles field, estimate the distance from the subject property based on the addresses. If you cannot determine the distance, use 0.`;
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

  // Build prompt: verified data if available, otherwise Claude knowledge (unverified)
  const userPrompt = scrapeResult.comps.length > 0
    ? buildVerifiedCompsPrompt({
        address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
        subjectYearBuilt, propertyType, sourceUrl,
        scrapedComps: scrapeResult.comps,
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

        if (scrapeResult.comps.length > 0) {
          send("log", { message: `Data source: ${scrapeResult.comps.length} verified comps from ${scrapeResult.source}` });
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
