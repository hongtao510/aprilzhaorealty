import Link from "next/link";
import { getListings, formatPrice } from "@/lib/data";

export default function ListingsPage() {
  const listings = getListings();
  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");

  return (
    <div>
      {/* Hero */}
      <section className="bg-[#381b5e] text-white py-20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#c181ff] rounded-full blur-3xl opacity-20" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <h1 className="text-5xl font-bold mb-4">Listings</h1>
          <p className="text-xl text-purple-200">
            Explore available properties and recent sales
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Active Listings */}
        <section className="mb-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 bg-[#b1ff8f] rounded-full animate-pulse" />
            <h2 className="text-2xl font-bold">Available Now</h2>
            <span className="text-sm text-zinc-500">({activeListings.length} properties)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group bg-white rounded-2xl overflow-hidden border border-zinc-100 hover-lift card-shine"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-zinc-200 to-zinc-300 relative">
                  <div className="absolute top-4 left-4 px-3 py-1 bg-[#b1ff8f] text-[#381b5e] text-xs font-bold rounded-full">
                    FOR SALE
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg group-hover:text-[#381b5e] transition-colors">
                      {listing.address}
                    </h3>
                  </div>
                  <p className="text-zinc-500 text-sm mb-3">{listing.city}</p>
                  <p className="text-2xl font-bold text-[#381b5e] mb-4">
                    {formatPrice(listing.price)}
                  </p>
                  <div className="flex gap-4 text-sm text-zinc-600 pt-4 border-t border-zinc-100">
                    <span className="flex items-center gap-1">
                      <span className="font-semibold">{listing.bedrooms}</span> beds
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold">{listing.bathrooms}</span> baths
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-semibold">{listing.sqft.toLocaleString()}</span> sqft
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {activeListings.length === 0 && (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl">
              <p className="text-zinc-500">No active listings at the moment. Check back soon!</p>
            </div>
          )}
        </section>

        {/* Sold Listings */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-3 h-3 bg-[#c181ff] rounded-full" />
            <h2 className="text-2xl font-bold">Recently Sold</h2>
            <span className="text-sm text-zinc-500">({soldListings.length} properties)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {soldListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group bg-white rounded-2xl overflow-hidden border border-zinc-100 hover-lift"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-zinc-200 to-zinc-300 relative">
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="absolute top-4 left-4 px-3 py-1 bg-[#381b5e] text-white text-xs font-bold rounded-full">
                    SOLD
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg group-hover:text-[#381b5e] transition-colors">
                      {listing.address}
                    </h3>
                  </div>
                  <p className="text-zinc-500 text-sm mb-3">{listing.city}</p>
                  <p className="text-2xl font-bold text-zinc-400 mb-2">
                    {formatPrice(listing.price)}
                  </p>
                  {listing.soldDate && (
                    <p className="text-xs text-zinc-400">Sold {listing.soldDate}</p>
                  )}
                  <div className="flex gap-4 text-sm text-zinc-500 pt-4 mt-3 border-t border-zinc-100">
                    <span>{listing.bedrooms} beds</span>
                    <span>{listing.bathrooms} baths</span>
                    <span>{listing.sqft.toLocaleString()} sqft</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* CTA */}
      <section className="bg-zinc-50 py-16">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Don&apos;t see what you&apos;re looking for?</h2>
          <p className="text-zinc-600 mb-8">I have access to off-market properties and upcoming listings.</p>
          <Link
            href="/contact"
            className="inline-block px-8 py-4 bg-[#381b5e] text-white font-semibold rounded-full hover:bg-[#4a2578] transition-all hover:-translate-y-1"
          >
            Contact Me
          </Link>
        </div>
      </section>
    </div>
  );
}
