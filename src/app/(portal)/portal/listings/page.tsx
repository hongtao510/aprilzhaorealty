import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

interface ListingRow {
  id: string;
  redfin_url: string;
  address: string;
  city: string;
  zip: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  image_url: string | null;
  first_seen_at: string | null;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export default async function PortalListingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/portal/listings");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "newsletter_cities, filter_property_types, filter_min_price, filter_max_price, filter_min_beds, filter_min_baths, filter_min_sqft, filter_max_sqft"
    )
    .eq("id", user.id)
    .single();

  const cities = (profile?.newsletter_cities ?? []) as string[];
  const propTypes = (profile?.filter_property_types ?? []) as string[];
  const minPrice = profile?.filter_min_price ?? null;
  const maxPrice = profile?.filter_max_price ?? null;
  const minBeds = profile?.filter_min_beds ?? null;
  const minBaths = profile?.filter_min_baths ?? null;
  const minSqft = profile?.filter_min_sqft ?? null;
  const maxSqft = profile?.filter_max_sqft ?? null;

  let listings: ListingRow[] = [];
  let query = supabase
    .from("redfin_listings")
    .select(
      "id, redfin_url, address, city, zip, price, beds, baths, sqft, year_built, property_type, image_url, first_seen_at"
    )
    .eq("status", "active");

  if (cities.length > 0) query = query.in("city", cities);
  if (propTypes.length > 0) query = query.in("property_type", propTypes);
  if (minPrice != null) query = query.gte("price", minPrice);
  if (maxPrice != null) query = query.lte("price", maxPrice);
  if (minBeds != null) query = query.gte("beds", minBeds);
  if (minBaths != null) query = query.gte("baths", minBaths);
  if (minSqft != null) query = query.gte("sqft", minSqft);
  if (maxSqft != null) query = query.lte("sqft", maxSqft);

  const { data } = await query
    .order("first_seen_at", { ascending: false })
    .limit(60);
  listings = (data ?? []) as ListingRow[];

  const noCities = cities.length === 0;

  return (
    <main className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
      <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
        Your Portal
      </p>
      <h1 className="font-serif text-4xl text-neutral-900 mb-3">
        Browse Listings
      </h1>
      <div className="w-16 h-0.5 bg-[#d4a012] mb-8" />

      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div className="text-sm text-neutral-600">
          Showing {listings.length} {listings.length === 1 ? "listing" : "listings"}
          {cities.length > 0 && (
            <>
              {" "}in{" "}
              <span className="font-medium text-neutral-900">
                {cities.join(", ")}
              </span>
            </>
          )}
          {noCities && (
            <>
              {" "}— no cities selected yet.
            </>
          )}
        </div>
        <Link
          href="/portal"
          className="px-5 py-2 border border-neutral-300 text-xs uppercase tracking-wider text-neutral-600 hover:border-[#d4a012] hover:text-[#d4a012] transition-colors"
        >
          Edit preferences
        </Link>
      </div>

      {noCities ? (
        <div className="bg-neutral-50 p-10 text-center">
          <p className="text-neutral-500 mb-6">
            Pick at least one city to start browsing listings.
          </p>
          <Link
            href="/portal"
            className="inline-block px-8 py-3 bg-[#d4a012] text-white text-xs uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors"
          >
            Set preferences
          </Link>
        </div>
      ) : listings.length === 0 ? (
        <div className="bg-neutral-50 p-10 text-center">
          <p className="text-neutral-600 mb-2">
            No active listings match your filters right now.
          </p>
          <p className="text-neutral-500 text-sm">
            Try relaxing a filter, or wait — new listings come in every morning.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((l) => {
            const details = [
              l.beds ? `${l.beds} bd` : null,
              l.baths ? `${l.baths} ba` : null,
              l.sqft ? `${fmt(l.sqft)} sqft` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <a
                key={l.id}
                href={l.redfin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block bg-white border border-neutral-200 overflow-hidden hover:border-[#d4a012] transition-colors"
              >
                <div className="h-48 bg-neutral-100 overflow-hidden">
                  {l.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.image_url}
                      alt={l.address}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-5xl text-neutral-300">
                      &#8962;
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="font-serif text-2xl text-neutral-900 mb-1">
                    ${fmt(l.price)}
                  </p>
                  <p className="text-sm text-neutral-700 mb-2">
                    {l.address}
                  </p>
                  <p className="text-xs text-neutral-500 mb-3">
                    {l.city}
                    {l.zip ? ` ${l.zip}` : ""}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {details}
                    {l.year_built ? ` · Built ${l.year_built}` : ""}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}
