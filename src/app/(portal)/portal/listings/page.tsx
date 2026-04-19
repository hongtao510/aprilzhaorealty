import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PRICE_RANGE_BUCKETS,
  SQFT_RANGE_BUCKETS,
  valueInAnyRange,
} from "@/lib/filter-ranges";

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
  status: string | null;
  days_on_market: number | null;
  last_seen_at: string | null;
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  // Redfin uses "active" for on-market. Anything else we style as neutral.
  if (s.includes("active") || s.includes("for sale") || s === "") {
    return { text: "For Sale", bg: "bg-emerald-600", fg: "text-white" };
  }
  if (s.includes("pending") || s.includes("contingent")) {
    return { text: status!, bg: "bg-amber-500", fg: "text-white" };
  }
  if (s.includes("off") || s.includes("sold") || s.includes("closed")) {
    return { text: "Off Market", bg: "bg-neutral-500", fg: "text-white" };
  }
  return { text: status!, bg: "bg-neutral-700", fg: "text-white" };
}

function daysAgo(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
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
      "newsletter_cities, filter_property_types, filter_price_ranges, filter_sqft_ranges, filter_min_beds, filter_min_baths"
    )
    .eq("id", user.id)
    .single();

  const cities = (profile?.newsletter_cities ?? []) as string[];
  const propTypes = (profile?.filter_property_types ?? []) as string[];
  const priceRanges = (profile?.filter_price_ranges ?? []) as string[];
  const sqftRanges = (profile?.filter_sqft_ranges ?? []) as string[];
  const minBeds = profile?.filter_min_beds ?? null;
  const minBaths = profile?.filter_min_baths ?? null;

  // Query applies city/type/bed/bath at the DB; price + sqft ranges
  // (multi-select unions) are filtered in memory since PostgREST can't
  // express "falls into ANY of these disjoint ranges" cleanly.
  // Active AND off-market are both fetched so users can see recent
  // closures alongside current listings.
  let query = supabase
    .from("redfin_listings")
    .select(
      "id, redfin_url, address, city, zip, price, beds, baths, sqft, year_built, property_type, image_url, first_seen_at, status, days_on_market, last_seen_at"
    );

  if (cities.length > 0) query = query.in("city", cities);
  if (propTypes.length > 0) query = query.in("property_type", propTypes);
  if (minBeds != null) query = query.gte("beds", minBeds);
  if (minBaths != null) query = query.gte("baths", minBaths);

  const { data } = await query
    .order("first_seen_at", { ascending: false })
    .limit(500); // over-fetch; we trim after in-memory range filter below

  const prelim = (data ?? []) as ListingRow[];
  const matching = prelim.filter(
    (l) =>
      valueInAnyRange(l.price, priceRanges, PRICE_RANGE_BUCKETS) &&
      valueInAnyRange(l.sqft, sqftRanges, SQFT_RANGE_BUCKETS)
  );

  // Split active vs closed so we can render them in two sections
  const active = matching
    .filter((l) => (l.status || "").toLowerCase() === "active")
    .slice(0, 60);
  const closed = matching
    .filter((l) => (l.status || "").toLowerCase() !== "active")
    .slice(0, 30);

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
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-neutral-900">
              {active.length}
            </span>{" "}
            active
          </span>
          <span className="mx-3 text-neutral-300">·</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-neutral-400" />
            <span className="font-medium text-neutral-900">
              {closed.length}
            </span>{" "}
            off market
          </span>
          {cities.length > 0 && (
            <>
              <span className="mx-3 text-neutral-300">·</span>
              <span className="text-neutral-500">{cities.join(", ")}</span>
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
      ) : active.length === 0 && closed.length === 0 ? (
        <div className="bg-neutral-50 p-10 text-center">
          <p className="text-neutral-600 mb-2">
            No listings match your filters right now.
          </p>
          <p className="text-neutral-500 text-sm">
            Try relaxing a filter, or wait — new listings come in every morning.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-14">
              <header className="flex items-baseline gap-3 mb-5 pb-3 border-b border-neutral-200">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <h2 className="font-serif text-2xl text-neutral-900">
                  Active
                </h2>
                <span className="text-sm text-neutral-500">
                  {active.length} {active.length === 1 ? "listing" : "listings"}{" "}
                  currently for sale
                </span>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {active.map((l) => (
                  <ListingCard key={l.id} l={l} variant="active" />
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section>
              <header className="flex items-baseline gap-3 mb-5 pb-3 border-b border-neutral-200">
                <span className="w-2.5 h-2.5 rounded-full bg-neutral-400" />
                <h2 className="font-serif text-2xl text-neutral-500">
                  Off Market
                </h2>
                <span className="text-sm text-neutral-500">
                  {closed.length} recently{" "}
                  {closed.length === 1 ? "removed" : "removed or sold"}
                </span>
              </header>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {closed.map((l) => (
                  <ListingCard key={l.id} l={l} variant="closed" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

function ListingCard({
  l,
  variant,
}: {
  l: ListingRow;
  variant: "active" | "closed";
}) {
  const details = [
    l.beds ? `${l.beds} bd` : null,
    l.baths ? `${l.baths} ba` : null,
    l.sqft ? `${fmt(l.sqft)} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const closed = variant === "closed";
  const b = statusBadge(l.status);
  return (
    <a
      href={l.redfin_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block bg-white border overflow-hidden transition-colors ${
        closed
          ? "border-neutral-200 opacity-75 hover:opacity-100 hover:border-neutral-400"
          : "border-neutral-200 hover:border-[#d4a012]"
      }`}
    >
      <div className="relative h-48 bg-neutral-100 overflow-hidden">
        {l.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.image_url}
            alt={l.address}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              closed ? "grayscale group-hover:grayscale-0" : ""
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-neutral-300">
            &#8962;
          </div>
        )}
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest ${b.bg} ${b.fg}`}
        >
          {b.text}
        </span>
        {!closed && l.days_on_market != null && l.days_on_market >= 0 && (
          <span className="absolute top-3 right-3 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest bg-white/90 text-neutral-700">
            {l.days_on_market === 0 ? "New" : `${l.days_on_market}d on market`}
          </span>
        )}
      </div>
      <div className="p-5">
        <p
          className={`font-serif text-2xl mb-1 ${
            closed ? "text-neutral-500 line-through" : "text-neutral-900"
          }`}
        >
          ${fmt(l.price)}
        </p>
        <p
          className={`text-sm mb-2 ${
            closed ? "text-neutral-500" : "text-neutral-700"
          }`}
        >
          {l.address}
        </p>
        <p className="text-xs text-neutral-500 mb-3">
          {l.city}
          {l.zip ? ` ${l.zip}` : ""}
        </p>
        <p className="text-xs text-neutral-500 mb-1">
          {details}
          {l.year_built ? ` · Built ${l.year_built}` : ""}
        </p>
        {l.last_seen_at && (
          <p className="text-[11px] text-neutral-400">
            {closed ? "Last seen" : "Last verified"} {daysAgo(l.last_seen_at)}
          </p>
        )}
      </div>
    </a>
  );
}
