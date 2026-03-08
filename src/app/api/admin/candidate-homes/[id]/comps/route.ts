import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { CompsResult } from "@/lib/types";

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

const SYSTEM_PROMPT = `You are a real estate Comparative Market Analysis (CMA) expert. Given a subject property, produce a JSON object matching the CompsResult schema exactly. Return ONLY valid JSON — no markdown, no explanation, no code fences.

CompsResult schema:
{
  "comps": [CompHome, ...],          // exactly 8 comparable recently-sold homes
  "subject": { "address": string, "sqft": number, "beds": number, "baths": number, "lot_sqft": number },
  "estimate": {
    "weighted_price_per_sqft": number,
    "comp_based": number,            // weighted average comp-based estimate
    "trend_adjusted": number,        // comp_based adjusted for market trend
    "market_temperature": "hot" | "warm" | "cool",
    "trend_adjustment_pct": number,  // e.g. 2.5 means +2.5%
    "range": {
      "most_likely": [low, high],    // ~68% confidence
      "likely": [low, high],         // ~90% confidence
      "possible": [low, high],       // ~95% confidence
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

CompHome schema:
{
  "address": string,
  "sold_price": number,
  "sold_date": string,              // YYYY-MM-DD
  "sqft": number,
  "beds": number,
  "baths": number,
  "lot_sqft": number,
  "similarity_score": number,       // 0.0-1.0 decimal, see rules below
  "price_per_sqft": number,
  "reason": string                  // why this comp was chosen
}

Similarity scoring rules (scores are 0.0-1.0 decimals):
- House Size (50% weight): score = max(0, 1 - abs(comp_sqft - subject_sqft) / subject_sqft / 0.20)
- Bed+Bath Count (30% weight): score = max(0, 1 - abs((comp_beds+comp_baths) - (subject_beds+subject_baths)) / 3)
- Lot Size (20% weight): score = max(0, 1 - abs(comp_lot - subject_lot) / subject_lot / 0.30)
- Combined: total_score = 0.50 * size_score + 0.30 * bedbath_score + 0.20 * lot_score

Price estimation rules:
- Weight comps by similarity_score (higher = more weight)
- Calculate weighted average price_per_sqft then multiply by subject sqft
- Apply market trend adjustment for trend_adjusted value
- Cap "most_likely" range at $200,000 wide maximum
- Build sub-ranges with $100,000 bands outward from most_likely
- Round all range boundaries to nearest $25,000

Market temperature rules:
- "hot": sale_to_list > 100% AND days_on_market < 14 AND yoy_change > +5%
- "cool": sale_to_list < 97% OR days_on_market > 30 OR yoy_change < -2%
- "warm": everything else`;

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
      return NextResponse.json(cached.comps as CompsResult);
    }
  }

  // Build user prompt
  const address = home.address || home.title || "Unknown address";
  const price = home.price || home.price_numeric || "Unknown";
  const sqft = home.sqft || "Unknown";
  const beds = home.beds ?? "Unknown";
  const baths = home.baths ?? "Unknown";

  const userPrompt = `Perform a CMA for this subject property:

Address: ${address}
List Price: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}
Square Feet: ${sqft}
Bedrooms: ${beds}
Bathrooms: ${baths}

Find the top 8 comparable recently-sold homes in the same area and produce the CompsResult JSON.`;

  // Call Claude API
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
      return NextResponse.json(
        { error: "No text response from Claude" },
        { status: 502 }
      );
    }
    rawResponse = textBlock.text;
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Claude API call failed";
    return NextResponse.json({ error: errorMessage }, { status: 502 });
  }

  // Parse response — strip markdown code fences if present
  let compsResult: CompsResult;
  try {
    const cleaned = rawResponse
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    compsResult = JSON.parse(cleaned) as CompsResult;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude response as JSON", raw: rawResponse },
      { status: 502 }
    );
  }

  // Delete old cache rows for this home, then insert new one
  await supabase
    .from("candidate_comps")
    .delete()
    .eq("candidate_home_id", id);

  const { error: insertError } = await supabase
    .from("candidate_comps")
    .insert({
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
    // Still return the result even if caching fails
    console.error("Failed to cache comps result:", insertError.message);
  }

  return NextResponse.json(compsResult);
}
