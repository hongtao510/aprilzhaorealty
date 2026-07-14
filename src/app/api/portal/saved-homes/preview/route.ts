import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchListingHtml, ListingUrlError } from "@/lib/listing-url";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json().catch(() => ({}));

  try {
    const { html } = await fetchListingHtml(url, 5000);

    const ogTitle = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
    )?.[1] ?? null;

    const ogImage = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )?.[1] ?? null;

    const ogDescription = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ?? html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i
    )?.[1] ?? null;

    // Extract price from OG data or page content
    const priceSource = `${ogTitle || ""} ${ogDescription || ""}`;
    const priceMatch = priceSource.match(/\$[\d,]+/);
    const price = priceMatch ? priceMatch[0] : null;

    // Extract address from OG title (strip site suffix)
    let address: string | null = null;
    if (ogTitle) {
      address = ogTitle
        .replace(/\s*\|.*$/, "")
        .replace(/\s*[-–—].*(?:Redfin|Zillow|Realtor|Trulia).*$/i, "")
        .trim();
      // If price is in the address string, remove it
      if (address && price) {
        address = address.replace(price, "").replace(/^\s*,\s*|\s*,\s*$/, "").trim();
      }
    }

    return NextResponse.json({
      title: ogTitle,
      image_url: ogImage,
      address,
      price,
    });
  } catch (error) {
    const message = error instanceof ListingUrlError
      ? error.message
      : "Unable to retrieve the listing page";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
