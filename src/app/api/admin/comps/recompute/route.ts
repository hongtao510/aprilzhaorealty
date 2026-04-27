import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeEstimate } from "@/lib/comps/pricing";
import type { CompsEstimate } from "@/lib/types";

/**
 * Stateless pricing recompute. Used by the manual map-picker:
 * client sends the user-selected comps + subject sqft/lot, we return a fresh
 * estimate computed with the same deterministic pipeline.
 */
interface RecomputeBody {
  subjectSqft: number;
  subjectLotSqft?: number | null;
  marketTemperature?: CompsEstimate["market_temperature"];
  trendPct?: number;
  comps: {
    sold_price: number;
    sqft: number;
    similarity_score: number;
    lot_sqft?: number | null;
  }[];
}

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Forbidden" as const, status: 403 as const };
  return { error: null };
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: RecomputeBody;
  try {
    body = (await request.json()) as RecomputeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.subjectSqft || body.subjectSqft <= 0) {
    return NextResponse.json({ error: "subjectSqft is required" }, { status: 400 });
  }
  if (!Array.isArray(body.comps) || body.comps.length === 0) {
    return NextResponse.json({ error: "Pick at least one comp" }, { status: 400 });
  }

  const estimate = computeEstimate({
    subjectSqft: body.subjectSqft,
    subjectLotSqft: body.subjectLotSqft ?? null,
    comps: body.comps,
    marketTemperature: body.marketTemperature ?? "warm",
    trendPct: body.trendPct,
    strategy: "hybrid",
  });

  return NextResponse.json({ estimate });
}
