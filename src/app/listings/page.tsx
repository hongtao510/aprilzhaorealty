import Link from "next/link";
import Image from "next/image";
import { getListings, formatPrice } from "@/lib/data";

export default function ListingsPage() {
  const listings = getListings();
  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#381b5e] via-[#4a2578] to-[#381b5e]">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#c181ff]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-[#5e74ff]/10 rounded-full blur-3xl" />
        </div>

        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 text-[#b1ff8f] text-sm font-medium rounded-full mb-6">
              <span className="w-2 h-2 bg-[#b1ff8f] rounded-full" />
              {listings.length} Properties
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              Property Portfolio
            </h1>
            <p className="text-lg md:text-xl text-purple-200 max-w-2xl leading-relaxed">
              Explore my complete collection of properties, from available homes to recently closed transactions across the Bay Area.
            </p>
          </div>
        </div>

        {/* Bottom curve */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 60L1440 60L1440 0C1440 0 1082.5 60 720 60C357.5 60 0 0 0 0L0 60Z" fill="white"/>
          </svg>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-20">
        {/* Active Listings Section */}
        {activeListings.length > 0 && (
          <section className="mb-24">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-[#b1ff8f]/20 rounded-xl">
                  <span className="w-3 h-3 bg-[#b1ff8f] rounded-full animate-pulse" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Available Now</h2>
                  <p className="text-zinc-500 mt-1">{activeListings.length} {activeListings.length === 1 ? 'property' : 'properties'} for sale</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listings/${listing.id}`}
                  className="group bg-white rounded-2xl overflow-hidden border-2 border-[#b1ff8f]/30 hover:border-[#b1ff8f] transition-all duration-300 hover:shadow-xl hover:shadow-[#b1ff8f]/10 hover:-translate-y-1"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 relative overflow-hidden">
                    {listing.images[0] && (
                      <Image
                        src={listing.images[0]}
                        alt={listing.address}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    {/* Status Badge */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-flex items-center gap-2 px-4 py-2 bg-[#b1ff8f] text-[#381b5e] text-xs font-bold rounded-lg shadow-lg">
                        <span className="w-2 h-2 bg-[#381b5e] rounded-full animate-pulse" />
                        FOR SALE
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-zinc-900 group-hover:text-[#381b5e] transition-colors mb-1">
                      {listing.address}
                    </h3>
                    <p className="text-zinc-500 text-sm mb-4">{listing.city}</p>
                    <p className="text-2xl font-bold text-[#381b5e] mb-4">
                      {formatPrice(listing.price)}
                    </p>
                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                      <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        <span className="font-semibold">{listing.bedrooms}</span> beds
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                        <span className="font-semibold">{listing.bathrooms}</span> baths
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                        <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                        <span className="font-semibold">{listing.sqft.toLocaleString()}</span> sqft
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Sold Listings Section */}
        <section>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 bg-[#381b5e]/10 rounded-xl">
                <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">Successfully Sold</h2>
                <p className="text-zinc-500 mt-1">{soldListings.length} completed transactions</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {soldListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="group bg-white rounded-2xl overflow-hidden border border-zinc-100 hover:border-zinc-200 transition-all duration-300 hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-1"
              >
                <div className="aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 relative overflow-hidden">
                  {listing.images[0] && (
                    <Image
                      src={listing.images[0]}
                      alt={listing.address}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  {/* Sold overlay */}
                  <div className="absolute inset-0 bg-black/10" />

                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#381b5e] text-white text-xs font-semibold rounded-lg shadow-lg">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      SOLD
                    </span>
                  </div>

                  {/* Price Tag */}
                  <div className="absolute bottom-4 right-4 z-10">
                    <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-zinc-700 text-sm font-bold rounded-lg shadow-lg">
                      {formatPrice(listing.price)}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-zinc-900 group-hover:text-[#381b5e] transition-colors mb-1">
                    {listing.address}
                  </h3>
                  <p className="text-zinc-500 text-sm mb-3">{listing.city}</p>

                  {listing.soldDate && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-50 rounded-lg text-xs text-zinc-600 mb-4">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Sold {listing.soldDate}
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <span className="font-medium">{listing.bedrooms}</span> beds
                    </div>
                    <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <span className="font-medium">{listing.bathrooms}</span> baths
                    </div>
                    <div className="w-1 h-1 bg-zinc-300 rounded-full" />
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <span className="font-medium">{listing.sqft.toLocaleString()}</span> sqft
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-zinc-50 to-white py-20 md:py-24">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#381b5e]/5 rounded-2xl mb-6">
            <svg className="w-8 h-8 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            Don&apos;t See What You&apos;re Looking For?
          </h2>
          <p className="text-lg text-zinc-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            I have access to off-market properties and upcoming listings. Let&apos;s discuss your specific needs and find the perfect property together.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="group px-8 py-4 bg-[#381b5e] text-white font-semibold rounded-xl hover:bg-[#4a2578] transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 hover:-translate-y-0.5 flex items-center gap-2"
            >
              Contact Me
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="mailto:aprilcasf@gmail.com"
              className="px-8 py-4 bg-white border-2 border-zinc-200 text-zinc-800 font-semibold rounded-xl hover:border-[#381b5e] hover:text-[#381b5e] transition-all duration-300 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email Directly
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
