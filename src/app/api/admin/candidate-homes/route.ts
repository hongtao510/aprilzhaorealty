import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { url } = await request.json();

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

  // Scrape OG preview
  let preview = { title: null as string | null, image_url: null as string | null, address: null as string | null, price: null as string | null };
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
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
    }
  } catch {
    // Preview scraping is best-effort
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
