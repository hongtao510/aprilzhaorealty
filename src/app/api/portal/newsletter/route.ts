import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { FEATURED_CITIES } from "@/lib/redfin-listings";

const VALID_CITIES = new Set(FEATURED_CITIES.map((c) => c.name));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cities: unknown = body?.cities;

  if (!Array.isArray(cities) || !cities.every((c): c is string => typeof c === "string")) {
    return NextResponse.json(
      { error: "Invalid payload: expected { cities: string[] }" },
      { status: 400 }
    );
  }

  // Deduplicate + reject unknown cities (don't silently drop — surface it)
  const unique = Array.from(new Set(cities));
  const invalid = unique.filter((c) => !VALID_CITIES.has(c));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown cities: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({ newsletter_cities: unique })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  return NextResponse.json({ cities: unique });
}
