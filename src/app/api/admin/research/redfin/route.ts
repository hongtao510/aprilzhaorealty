import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  scrapePropertyDetails,
  searchByAddress,
  scrapeComparables,
} from "@/lib/redfin-browser";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return { error: "Unauthorized" as const, status: 401 as const };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    return { error: "Forbidden" as const, status: 403 as const };

  return { user, error: null, status: null };
}

// GET /api/admin/research/redfin?action=details&url=...
// GET /api/admin/research/redfin?action=search&address=...
// GET /api/admin/research/redfin?action=comps&url=...
export async function GET(request: NextRequest) {
  const { error, status } = await verifyAdmin();
  if (error) return NextResponse.json({ error }, { status: status! });

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const disclaimer = "Research use only. Respect Redfin Terms of Service.";

  try {
    switch (action) {
      case "details": {
        const url = searchParams.get("url");
        if (!url)
          return NextResponse.json(
            { error: "url parameter required" },
            { status: 400 }
          );
        const data = await scrapePropertyDetails(url);
        return NextResponse.json({ disclaimer, data });
      }

      case "search": {
        const address = searchParams.get("address");
        if (!address)
          return NextResponse.json(
            { error: "address parameter required" },
            { status: 400 }
          );
        const data = await searchByAddress(address);
        return NextResponse.json({ disclaimer, data });
      }

      case "comps": {
        const url = searchParams.get("url");
        if (!url)
          return NextResponse.json(
            { error: "url parameter required" },
            { status: 400 }
          );
        const data = await scrapeComparables(url);
        return NextResponse.json({ disclaimer, data });
      }

      default:
        return NextResponse.json(
          {
            error:
              "action parameter required: details, search, or comps",
            usage: {
              details:
                "/api/admin/research/redfin?action=details&url=https://www.redfin.com/...",
              search:
                "/api/admin/research/redfin?action=search&address=123 Main St, City, CA",
              comps:
                "/api/admin/research/redfin?action=comps&url=https://www.redfin.com/...",
            },
          },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("[research/redfin] Scraping error:", err);
    return NextResponse.json(
      {
        error: "Scraping failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
