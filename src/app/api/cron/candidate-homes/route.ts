import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Authenticate via CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: { label: string; inserted: number; error?: string }[] = [];

  try {
    // Fetch active search criteria
    const { data: criteria, error: criteriaError } = await supabase
      .from("search_criteria")
      .select("*")
      .eq("is_active", true);

    if (criteriaError) {
      return NextResponse.json(
        { error: "Failed to fetch search criteria", details: criteriaError.message },
        { status: 500 }
      );
    }

    if (!criteria || criteria.length === 0) {
      return NextResponse.json({ message: "No active search criteria", results: [] });
    }

    for (const criterion of criteria) {
      try {
        // Build Redfin stingray API URL
        const params = new URLSearchParams({
          al: "1",
          include_nearby_homes: "true",
          market: "socal",
          num_homes: "100",
          ord: "redfin-recommended-asc",
          page_number: "1",
          region_id: criterion.region_id,
          region_type: String(criterion.region_type),
          sf: "1,2,3,5,6,7",
          status: "9",
          uipt: criterion.property_types?.join(",") || "1,2,3",
          v: "8",
        });

        if (criterion.min_price) params.set("min_price", String(criterion.min_price));
        if (criterion.max_price) params.set("max_price", String(criterion.max_price));
        if (criterion.min_beds) params.set("min_beds", String(criterion.min_beds));
        if (criterion.min_baths) params.set("min_baths", String(criterion.min_baths));

        const url = `https://www.redfin.com/stingray/api/gis?${params.toString()}`;

        const response = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
          results.push({ label: criterion.label, inserted: 0, error: `HTTP ${response.status}` });
          continue;
        }

        const text = await response.text();
        // Redfin prefixes JSON with {}&&
        const jsonStr = text.replace(/^{}&&/, "");
        const data = JSON.parse(jsonStr);

        const homes = data?.payload?.homes || [];
        if (homes.length === 0) {
          results.push({ label: criterion.label, inserted: 0 });
          continue;
        }

        // Map Redfin data to candidate_homes rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = homes.map((h: any) => {
          const info = h.homeData?.addressInfo || {};
          const price = h.homeData?.priceInfo || {};
          const beds = h.homeData?.bedInfo || {};
          const baths = h.homeData?.bathInfo || {};
          const sqftInfo = h.homeData?.sqftInfo || {};
          const urlPath = h.homeData?.url;

          const streetAddress = info.formattedStreetLine || "";
          const city = info.city || "";
          const state = info.state || "";
          const zip = info.zip || "";
          const fullAddress = [streetAddress, city, `${state} ${zip}`]
            .filter(Boolean)
            .join(", ");

          const priceValue = price.amount as number | undefined;

          return {
            url: urlPath ? `https://www.redfin.com${urlPath}` : `https://www.redfin.com`,
            title: streetAddress || null,
            image_url: h.homeData?.photos?.find(
              (p: any) => p.type === "PRIMARY" // eslint-disable-line @typescript-eslint/no-explicit-any
            )?.photoUrls?.fullScreenPhotoUrl || null,
            address: fullAddress || null,
            price: priceValue ? `$${priceValue.toLocaleString()}` : null,
            price_numeric: priceValue || null,
            beds: beds.value || null,
            baths: baths.value || null,
            sqft: sqftInfo.value || null,
            status: "new",
            source: "redfin",
            search_criteria_id: criterion.id,
          };
        }).filter((r: { url: string }) => r.url !== "https://www.redfin.com");

        if (rows.length === 0) {
          results.push({ label: criterion.label, inserted: 0 });
          continue;
        }

        const { data: inserted, error: insertError } = await supabase
          .from("candidate_homes")
          .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
          .select("id");

        if (insertError) {
          results.push({ label: criterion.label, inserted: 0, error: insertError.message });
        } else {
          results.push({ label: criterion.label, inserted: inserted?.length || 0 });
        }
      } catch (err) {
        results.push({
          label: criterion.label,
          inserted: 0,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ message: "Cron completed", results });
  } catch (error) {
    console.error("Cron candidate-homes error:", error);
    return NextResponse.json(
      { error: "Cron job failed", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
