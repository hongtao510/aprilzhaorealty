import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPropertyRecord } from "@/lib/rentcast";

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

// GET: List candidates with optional status filter
export async function GET(request: NextRequest) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  let query = supabase
    .from("candidate_homes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter && statusFilter !== "all") {
    // "saved" tab also shows "sent" homes (sent = saved + emailed)
    if (statusFilter === "saved") {
      query = query.in("status", ["saved", "sent"]);
    } else {
      query = query.eq("status", statusFilter);
    }
  }

  const { data, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Add manually by URL
export async function POST(request: NextRequest) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { url, beds: manualBeds, baths: manualBaths, sqft: manualSqft } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("candidate_homes")
    .select("id")
    .eq("url", url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "This listing is already in candidates" }, { status: 409 });
  }

  // Scrape OG preview + property details
  const preview = {
    title: null as string | null,
    image_url: null as string | null,
    address: null as string | null,
    price: null as string | null,
    beds: null as number | null,
    baths: null as number | null,
    sqft: null as number | null,
  };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const html = await response.text();

      const ogTitle =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ?? null;

      const ogImage =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ?? null;

      const ogDescription =
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i)?.[1] ?? null;

      const priceSource = `${ogTitle || ""} ${ogDescription || ""}`;
      const priceMatch = priceSource.match(/\$[\d,]+/);
      preview.price = priceMatch ? priceMatch[0] : null;

      if (ogTitle) {
        preview.address = ogTitle
          .replace(/\s*\|.*$/, "")
          .replace(/\s*[-–—].*(?:Redfin|Zillow|Realtor|Trulia).*$/i, "")
          .trim();
        if (preview.address && preview.price) {
          preview.address = preview.address.replace(preview.price, "").replace(/^\s*,\s*|\s*,\s*$/, "").trim();
        }
      }

      preview.title = ogTitle;
      preview.image_url = ogImage;

      // Extract beds, baths, sqft from OG description or page content
      // Common patterns: "3 bed, 2 bath, 1500 sqft" or "3 Beds · 2 Baths · 1,500 Sq. Ft."
      const detailSource = `${ogTitle || ""} ${ogDescription || ""}`;

      const bedsMatch = detailSource.match(/(\d+)\s*(?:beds?|bd|bedrooms?|br)\b/i);
      if (bedsMatch) preview.beds = parseInt(bedsMatch[1], 10);

      const bathsMatch = detailSource.match(/([\d.]+)\s*(?:baths?|ba|bathrooms?)\b/i);
      if (bathsMatch) preview.baths = parseFloat(bathsMatch[1]);

      const sqftMatch = detailSource.match(/([\d,]+)\s*(?:sq\.?\s*ft\.?|sqft|square\s*feet)/i);
      if (sqftMatch) preview.sqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);

      // Also try JSON-LD structured data (Redfin, Zillow, etc.)
      const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of jsonLdMatches) {
        try {
          const ld = JSON.parse(m[1]);
          const item = Array.isArray(ld) ? ld[0] : ld;
          if (item?.["@type"]?.match?.(/Residence|House|Product|RealEstateListing/i) || item?.["@type"]?.includes?.("Residence")) {
            if (!preview.beds && item.numberOfBedrooms) preview.beds = parseInt(item.numberOfBedrooms, 10);
            if (!preview.baths && item.numberOfBathroomsTotal) preview.baths = parseFloat(item.numberOfBathroomsTotal);
            if (!preview.sqft && item.floorSize?.value) preview.sqft = parseInt(String(item.floorSize.value).replace(/,/g, ""), 10);
          }
        } catch {
          // JSON-LD parsing is best-effort
        }
      }
    }
  } catch {
    // Preview scraping is best-effort
  }

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

  // Parse numeric price
  const priceNumeric = preview.price
    ? parseInt(preview.price.replace(/[$,]/g, ""), 10) || null
    : null;

  const { data, error: insertError } = await supabase
    .from("candidate_homes")
    .insert({
      url,
      title: preview.title,
      image_url: preview.image_url,
      address: preview.address,
      price: preview.price,
      price_numeric: priceNumeric,
      beds: manualBeds ?? preview.beds,
      baths: manualBaths ?? preview.baths,
      sqft: manualSqft ?? preview.sqft,
      status: "new",
      source: "manual",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PATCH: Bulk update status
export async function PATCH(request: NextRequest) {
  const { supabase, error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { ids, status: newStatus } = await request.json();

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  const allowedStatuses = ["new", "saved", "dismissed"];
  if (!allowedStatuses.includes(newStatus)) {
    return NextResponse.json({ error: `status must be one of: ${allowedStatuses.join(", ")}` }, { status: 400 });
  }

  const { error: updateError } = await supabase
    .from("candidate_homes")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ updated: ids.length });
}
