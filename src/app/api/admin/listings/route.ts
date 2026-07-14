import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_RESULTS = 100;

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

  if (profile?.role !== "admin") {
    return { supabase, error: "Forbidden" as const, status: 403 as const };
  }

  return { supabase, error: null, status: null };
}

function positiveNumber(value: string | null) {
  if (value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export async function GET(request: NextRequest) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city")?.trim();
  const propertyType = searchParams.get("propertyType")?.trim();
  const minPrice = positiveNumber(searchParams.get("minPrice"));
  const maxPrice = positiveNumber(searchParams.get("maxPrice"));
  const minBeds = positiveNumber(searchParams.get("minBeds"));
  const minBaths = positiveNumber(searchParams.get("minBaths"));

  let query = supabase
    .from("redfin_listings")
    .select("id, redfin_url, address, city, state, zip, price, beds, baths, sqft, property_type, days_on_market, image_url, first_seen_at")
    .eq("status", "active")
    .order("first_seen_at", { ascending: false })
    .order("price", { ascending: false })
    .limit(MAX_RESULTS);

  if (city) query = query.eq("city", city);
  if (propertyType) query = query.eq("property_type", propertyType);
  if (minPrice !== null) query = query.gte("price", minPrice);
  if (maxPrice !== null) query = query.lte("price", maxPrice);
  if (minBeds !== null) query = query.gte("beds", minBeds);
  if (minBaths !== null) query = query.gte("baths", minBaths);

  const { data: listings, error: listingError } = await query;
  if (listingError) {
    return NextResponse.json({ error: listingError.message }, { status: 500 });
  }

  const { data: facetRows, error: facetError } = await supabase
    .from("redfin_listings")
    .select("city, property_type")
    .eq("status", "active")
    .limit(1000);

  if (facetError) {
    return NextResponse.json({ error: facetError.message }, { status: 500 });
  }

  const urls = (listings ?? []).map((listing) => listing.redfin_url);
  let candidateUrls = new Set<string>();
  if (urls.length > 0) {
    const { data: candidates, error: candidateError } = await supabase
      .from("candidate_homes")
      .select("url")
      .in("url", urls);

    if (candidateError) {
      return NextResponse.json({ error: candidateError.message }, { status: 500 });
    }
    candidateUrls = new Set((candidates ?? []).map((candidate) => candidate.url));
  }

  return NextResponse.json({
    listings: (listings ?? []).map((listing) => ({
      ...listing,
      is_candidate: candidateUrls.has(listing.redfin_url),
    })),
    facets: {
      cities: Array.from(new Set((facetRows ?? []).map((listing) => listing.city))).sort(),
      propertyTypes: Array.from(
        new Set(
          (facetRows ?? [])
            .map((listing) => listing.property_type)
            .filter((propertyType): propertyType is string => Boolean(propertyType))
        )
      ).sort(),
    },
  });
}
