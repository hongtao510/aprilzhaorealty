"use client";

import { useCallback, useEffect, useState } from "react";

type Listing = {
  id: string;
  redfin_url: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  property_type: string | null;
  days_on_market: number | null;
  image_url: string | null;
  first_seen_at: string;
  is_candidate: boolean;
};

type Filters = {
  city: string;
  minPrice: string;
  maxPrice: string;
  minBeds: string;
  minBaths: string;
  propertyType: string;
};

const initialFilters: Filters = {
  city: "",
  minPrice: "",
  maxPrice: "",
  minBeds: "",
  minBaths: "",
  propertyType: "",
};

const priceOptions = [
  { value: "1000000", label: "$1M" },
  { value: "2000000", label: "$2M" },
  { value: "3000000", label: "$3M" },
  { value: "4000000", label: "$4M" },
];

const numberFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function AdminSearchPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [listings, setListings] = useState<Listing[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  const fetchListings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const response = await fetch(`/api/admin/listings?${params.toString()}`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load listings");
      setListings(data.listings);
      setCities(data.facets.cities);
      setPropertyTypes(data.facets.propertyTypes);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Unable to load listings");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchListings(controller.signal);
    return () => controller.abort();
  }, [fetchListings]);

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function addCandidate(listing: Listing) {
    setAddingId(listing.id);
    setError("");
    try {
      const response = await fetch("/api/admin/candidate-homes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: listing.id }),
      });
      const data = await response.json();
      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || "Unable to add candidate");
      }
      setListings((current) => current.map((item) =>
        item.id === listing.id ? { ...item, is_candidate: true } : item
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add candidate");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-[#d4a012]">Listing Search</p>
          <h1 className="font-serif text-3xl text-neutral-900">Active Homes</h1>
          <div className="mt-4 h-0.5 w-16 bg-[#d4a012]" />
        </div>
        <p className="text-sm text-neutral-500">Search the latest active inventory collected by the daily listing feed.</p>
      </div>

      <section className="mb-6 border-y border-neutral-200 bg-neutral-50 py-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <select value={filters.city} onChange={(event) => updateFilter("city", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">All cities</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
          <select value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">No min price</option>
            {priceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}+</option>)}
          </select>
          <select value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">No max price</option>
            {priceOptions.map((option) => <option key={option.value} value={option.value}>Less than {option.label}</option>)}
          </select>
          <select value={filters.minBeds} onChange={(event) => updateFilter("minBeds", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">Any beds</option>
            {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}+ beds</option>)}
          </select>
          <select value={filters.minBaths} onChange={(event) => updateFilter("minBaths", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">Any baths</option>
            {[1, 1.5, 2, 2.5, 3, 4].map((value) => <option key={value} value={value}>{value}+ baths</option>)}
          </select>
          <select value={filters.propertyType} onChange={(event) => updateFilter("propertyType", event.target.value)} className="border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-700 focus:border-[#d4a012] focus:outline-none">
            <option value="">All home types</option>
            {propertyTypes.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
      </section>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-neutral-400">
          {loading ? "Loading inventory" : `${listings.length} active listing${listings.length === 1 ? "" : "s"}`}
        </p>
        {Object.values(filters).some(Boolean) && (
          <button type="button" onClick={() => setFilters(initialFilters)} className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f]">Clear filters</button>
        )}
      </div>

      {error && <p className="mb-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-400">Loading active listings...</div>
      ) : listings.length === 0 ? (
        <div className="border border-neutral-200 bg-neutral-50 py-16 text-center">
          <p className="font-serif text-lg text-neutral-700">No active listings match these filters.</p>
          <p className="mt-2 text-sm text-neutral-400">Try broadening the search, or wait for the next listing feed refresh.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing.id} className="overflow-hidden border border-neutral-200 bg-white transition-colors hover:border-[#d4a012]">
              {listing.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.image_url} alt={listing.address} className="aspect-[16/10] w-full object-cover" />
              ) : (
                <div className="aspect-[16/10] bg-neutral-100" />
              )}
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <p className="font-serif text-2xl text-neutral-900">{numberFormatter.format(listing.price)}</p>
                  {listing.is_candidate && <span className="shrink-0 border border-[#d4a012]/30 bg-[#faf8f0] px-2 py-1 text-[10px] uppercase tracking-wider text-[#9d7610]">Added to Candidates</span>}
                </div>
                <p className="text-sm text-neutral-800">{listing.address}</p>
                <p className="mt-1 text-sm text-neutral-500">{listing.city}, {listing.state} {listing.zip}</p>
                <p className="mt-3 text-sm text-neutral-500">
                  {[listing.beds ? `${listing.beds} bd` : null, listing.baths ? `${listing.baths} ba` : null, listing.sqft ? `${listing.sqft.toLocaleString()} sqft` : null].filter(Boolean).join(" · ") || "Details pending"}
                </p>
                <p className="mt-1 min-h-5 text-xs text-neutral-400">{[listing.property_type, listing.days_on_market !== null ? `${listing.days_on_market} days on market` : null].filter(Boolean).join(" · ")}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-neutral-100 pt-3">
                  <a href={listing.redfin_url} target="_blank" rel="noopener noreferrer" className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f]">View Listing</a>
                  <button type="button" disabled={listing.is_candidate || addingId === listing.id} onClick={() => addCandidate(listing)} className="ml-auto bg-neutral-900 px-3 py-2 text-xs uppercase tracking-wider text-white hover:bg-neutral-700 disabled:cursor-default disabled:bg-neutral-200 disabled:text-neutral-500">
                    {addingId === listing.id ? "Adding..." : listing.is_candidate ? "Added" : "Add to Candidates"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
