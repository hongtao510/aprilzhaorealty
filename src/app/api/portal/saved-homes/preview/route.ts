import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        title: null,
        image_url: null,
        address: null,
        price: null,
      });
    }

    const html = await response.text();

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
  } catch {
    return NextResponse.json({
      title: null,
      image_url: null,
      address: null,
      price: null,
    });
  }
}
