import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getListing, getListings, formatPrice } from "@/lib/data";

export function generateStaticParams() {
  return getListings().map((listing) => ({
    id: listing.id,
  }));
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = getListing(id);

  if (!listing) {
    notFound();
  }

  return (
    <div className="bg-white">
      {/* Hero Image Section */}
      <section className="relative h-[50vh] md:h-[65vh] bg-gradient-to-br from-zinc-300 to-zinc-400">
        {listing.images[0] && (
          <Image
            src={listing.images[0]}
            alt={listing.address}
            fill
            className="object-cover object-right"
            priority
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Top Navigation */}
        <div className="absolute top-0 left-0 right-0 z-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between">
            {/* Back button */}
            <Link
              href="/listings"
              className="group flex items-center gap-2 px-4 py-2.5 bg-white/95 backdrop-blur-sm rounded-xl text-sm font-medium text-zinc-800 hover:bg-white transition-all shadow-lg"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Listings
            </Link>

            {/* Status badge */}
            {listing.status === "active" ? (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f59e0b] text-[#166534] font-bold text-sm rounded-xl shadow-lg">
                <span className="w-2 h-2 bg-[#166534] rounded-full animate-pulse" />
                FOR SALE
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#166534] text-white font-bold text-sm rounded-xl shadow-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                SOLD
              </span>
            )}
          </div>
        </div>

        {/* Property Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 pb-10">
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
                {listing.address}
              </h1>
              <p className="text-lg md:text-xl text-white/80 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {listing.city}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2">
            {/* Price and Key Stats */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 mb-8 border-b border-zinc-100">
              <div>
                <p className="text-3xl md:text-4xl font-bold text-[#166534]">
                  {formatPrice(listing.price)}
                </p>
                {listing.status === "sold" && listing.soldDate && (
                  <p className="text-sm text-zinc-500 mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Sold on {listing.soldDate}
                  </p>
                )}
              </div>

              {/* Property Stats Cards */}
              <div className="flex gap-4 md:gap-6">
                <div className="text-center px-5 py-3 bg-zinc-50 rounded-xl">
                  <p className="text-2xl font-bold text-zinc-900">{listing.bedrooms}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Beds</p>
                </div>
                <div className="text-center px-5 py-3 bg-zinc-50 rounded-xl">
                  <p className="text-2xl font-bold text-zinc-900">{listing.bathrooms}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Baths</p>
                </div>
                <div className="text-center px-5 py-3 bg-zinc-50 rounded-xl">
                  <p className="text-2xl font-bold text-zinc-900">{listing.sqft.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Sq Ft</p>
                </div>
                {listing.yearBuilt && (
                  <div className="text-center px-5 py-3 bg-zinc-50 rounded-xl">
                    <p className="text-2xl font-bold text-zinc-900">{listing.yearBuilt}</p>
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mt-1">Built</p>
                  </div>
                )}
              </div>
            </div>

            {/* About Section */}
            <div className="mb-12">
              <h2 className="text-xl md:text-2xl font-bold text-zinc-900 mb-4 flex items-center gap-3">
                <span className="w-1 h-6 bg-[#166534] rounded-full" />
                About This Property
              </h2>
              <p className="text-zinc-600 leading-relaxed text-lg">
                {listing.description}
              </p>
            </div>

            {/* Property Details Grid */}
            {(listing.garage || listing.heating || listing.cooling || listing.hoaFees) && (
              <div className="mb-12">
                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-3">
                  <span className="w-1 h-6 bg-[#166534] rounded-full" />
                  Property Details
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.garage && (
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#166534]/10 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Parking</p>
                          <p className="font-medium text-zinc-900">{listing.garage}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {listing.heating && (
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#166534]/10 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Heating</p>
                          <p className="font-medium text-zinc-900">{listing.heating}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {listing.cooling && (
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#166534]/10 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">Cooling</p>
                          <p className="font-medium text-zinc-900">{listing.cooling}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {listing.hoaFees && (
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#166534]/10 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">HOA Fees</p>
                          <p className="font-medium text-zinc-900">${listing.hoaFees}/month</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {listing.mlsNumber && (
                    <div className="p-4 bg-zinc-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#166534]/10 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#166534]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500 uppercase tracking-wide">MLS #</p>
                          <p className="font-medium text-zinc-900">{listing.mlsNumber}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Features Section */}
            {listing.features && listing.features.length > 0 && (
              <div className="mb-12">
                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-3">
                  <span className="w-1 h-6 bg-[#f59e0b] rounded-full" />
                  Features & Highlights
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {listing.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl hover:bg-[#f59e0b]/10 transition-colors">
                      <div className="w-2 h-2 bg-[#f59e0b] rounded-full flex-shrink-0" />
                      <span className="text-zinc-700">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Schools Section */}
            {listing.schools && (listing.schools.elementary || listing.schools.highSchool) && (
              <div className="mb-12">
                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 mb-6 flex items-center gap-3">
                  <span className="w-1 h-6 bg-[#0d9488] rounded-full" />
                  School Districts
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {listing.schools.elementary && (
                    <div className="p-5 bg-gradient-to-br from-[#0d9488]/5 to-transparent rounded-xl border border-[#0d9488]/10">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-5 h-5 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="text-sm text-zinc-500">Elementary District</p>
                      </div>
                      <p className="font-semibold text-zinc-900 text-lg">{listing.schools.elementary}</p>
                    </div>
                  )}
                  {listing.schools.highSchool && (
                    <div className="p-5 bg-gradient-to-br from-[#0d9488]/5 to-transparent rounded-xl border border-[#0d9488]/10">
                      <div className="flex items-center gap-3 mb-2">
                        <svg className="w-5 h-5 text-[#0d9488]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                        </svg>
                        <p className="text-sm text-zinc-500">High School District</p>
                      </div>
                      <p className="font-semibold text-zinc-900 text-lg">{listing.schools.highSchool}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 space-y-6">
              {/* Agent Card */}
              <div className="bg-gradient-to-br from-zinc-50 to-white rounded-2xl p-6 border border-zinc-100">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#86efac] to-[#0d9488] rounded-full flex items-center justify-center text-white text-xl font-bold">
                    AZ
                  </div>
                  <div>
                    <p className="font-bold text-lg text-zinc-900">April Zhao</p>
                    <p className="text-xs text-[#d4a012] tracking-wide mb-1">Expertise. Ethics. Excellence.</p>
                    <p className="text-xs text-neutral-500">BQ Realty</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 mb-6 leading-relaxed text-center">
                  Interested in a similar property?
                  <br />
                  I&apos;d love to help.
                </p>
                <Link
                  href="/contact"
                  className="block w-full py-4 bg-[#166534] text-white font-semibold rounded-xl text-center hover:bg-[#14532d] transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20"
                >
                  Contact April
                </Link>
                <a
                  href="mailto:aprilcasf@gmail.com"
                  className="block w-full py-3 mt-3 text-[#166534] font-medium text-center hover:bg-[#166534]/5 rounded-xl transition-colors text-sm"
                >
                  aprilcasf@gmail.com
                </a>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <button className="w-full py-3.5 px-4 bg-white border-2 border-zinc-100 rounded-xl font-medium hover:border-[#86efac] hover:bg-[#86efac]/5 transition-all duration-300 flex items-center justify-center gap-3 text-zinc-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share Listing
                </button>
                {listing.videoLink && (
                  <a
                    href={listing.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-white border-2 border-zinc-100 rounded-xl font-medium hover:border-[#ef4444] hover:bg-[#ef4444]/5 transition-all duration-300 flex items-center justify-center gap-3 text-zinc-700"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Video Tour
                  </a>
                )}
                {listing.mlsLink && (
                  <a
                    href={listing.mlsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-white border-2 border-zinc-100 rounded-xl font-medium hover:border-[#0d9488] hover:bg-[#0d9488]/5 transition-all duration-300 flex items-center justify-center gap-3 text-zinc-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Redfin
                  </a>
                )}
                {listing.zillowLink && (
                  <a
                    href={listing.zillowLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-white border-2 border-zinc-100 rounded-xl font-medium hover:border-[#006aff] hover:bg-[#006aff]/5 transition-all duration-300 flex items-center justify-center gap-3 text-zinc-700"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on Zillow
                  </a>
                )}
              </div>

              {/* Property Type Tag */}
              {listing.propertyType && (
                <div className="p-4 bg-[#166534]/5 rounded-xl text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Property Type</p>
                  <p className="font-semibold text-[#166534]">{listing.propertyType}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
