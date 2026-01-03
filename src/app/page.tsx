import Link from "next/link";
import { getRecentListings, formatPrice } from "@/lib/data";

export default function Home() {
  const recentListings = getRecentListings(6);
  return (
    <div>
      {/* Hero Section - Bold and Dynamic */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 gradient-bg opacity-5" />

        {/* Decorative shapes */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-[#c181ff] rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-[#5e74ff] rounded-full blur-3xl opacity-10" />

        <div className="max-w-7xl mx-auto px-6 py-20 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-block px-4 py-2 bg-[#b1ff8f] text-[#381b5e] text-sm font-semibold rounded-full mb-6">
              San Jose, CA · BQ Realty
            </div>
            <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              Find your
              <span className="block gradient-text">dream home</span>
            </h1>
            <p className="text-xl text-zinc-600 max-w-xl mb-10 leading-relaxed">
              Personalized service, deep local expertise, and a commitment to making your real estate journey seamless.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/listings"
                className="px-8 py-4 bg-[#381b5e] text-white font-semibold rounded-full hover:bg-[#4a2578] transition-all hover:shadow-xl hover:shadow-purple-500/25 hover:-translate-y-1"
              >
                Browse Listings
              </Link>
              <Link
                href="/contact"
                className="px-8 py-4 border-2 border-[#381b5e] text-[#381b5e] font-semibold rounded-full hover:bg-[#381b5e] hover:text-white transition-all"
              >
                Let&apos;s Talk
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Bold numbers */}
      <section className="bg-[#0a0a0a] text-white py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-5xl md:text-6xl font-bold text-[#b1ff8f]">23</p>
              <p className="text-zinc-400 mt-2">Closed Sales</p>
            </div>
            <div className="text-center">
              <p className="text-5xl md:text-6xl font-bold text-[#c181ff]">$57.6M</p>
              <p className="text-zinc-400 mt-2">Total Volume</p>
            </div>
            <div className="text-center">
              <p className="text-5xl md:text-6xl font-bold text-[#5e74ff]">$2.5M</p>
              <p className="text-zinc-400 mt-2">Avg Sale Price</p>
            </div>
            <div className="text-center">
              <p className="text-5xl md:text-6xl font-bold text-[#ff771c]">21</p>
              <p className="text-zinc-400 mt-2">Deals (2 Yr)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="py-24 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
            <div>
              <h2 className="text-4xl font-bold">Featured Listings</h2>
              <p className="text-zinc-600 mt-2">Handpicked properties for you</p>
            </div>
            <Link
              href="/listings"
              className="text-[#381b5e] font-semibold hover:underline underline-offset-4"
            >
              View all listings →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group bg-white rounded-2xl overflow-hidden hover-lift card-shine"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-zinc-200 to-zinc-300 relative">
                  <div className="absolute top-4 left-4 px-3 py-1 bg-[#381b5e] text-white text-xs font-semibold rounded-full">
                    SOLD
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg group-hover:text-[#381b5e] transition-colors">
                      {listing.address}
                    </h3>
                    <span className="text-[#381b5e] font-bold">{formatPrice(listing.price)}</span>
                  </div>
                  <p className="text-zinc-500 text-sm mb-4">{listing.city}</p>
                  <div className="flex gap-4 text-sm text-zinc-600">
                    <span>{listing.bedrooms} beds</span>
                    <span className="text-zinc-300">|</span>
                    <span>{listing.bathrooms} baths</span>
                    <span className="text-zinc-300">|</span>
                    <span>{listing.sqft.toLocaleString()} sqft</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[#381b5e]" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#4a2578] rounded-l-[100px]" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl text-white">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to find your perfect home?
            </h2>
            <p className="text-xl text-purple-200 mb-10 leading-relaxed">
              Whether you&apos;re buying, selling, or just exploring — I&apos;m here to help you every step of the way.
            </p>
            <Link
              href="/contact"
              className="inline-block px-8 py-4 bg-[#b1ff8f] text-[#381b5e] font-bold rounded-full hover:bg-[#c5ff9f] transition-all hover:-translate-y-1"
            >
              Get Started Today
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
