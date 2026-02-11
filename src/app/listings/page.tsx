"use client";

import Link from "next/link";
import Image from "next/image";
import { getListings, formatPrice } from "@/lib/data";
import ScrollReveal from "@/components/ScrollReveal";

export default function ListingsPage() {
  const listings = getListings();
  const activeListings = listings.filter((l) => l.status === "active");
  const soldListings = listings.filter((l) => l.status === "sold");

  return (
    <div className="bg-white">
      {/* Hero Section - Elegant minimal */}
      <section className="relative bg-[#eae6e1] py-24 md:py-32 border-b border-neutral-200">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, #1a1a1a 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-neutral-900 mb-6">
              Property Portfolio
            </h1>
            <div className="w-20 h-0.5 bg-[#d4a012] mb-8" />
            <p className="text-lg text-neutral-500 max-w-2xl leading-relaxed">
              Explore my upcoming listings and featured closed transactions across the Bay Area.
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20">
        {/* Active Listings Section */}
        {activeListings.length > 0 && (
          <section className="mb-24">
            <ScrollReveal>
              <div className="flex items-center gap-4 mb-12">
                <div>
                  <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">Available Now</p>
                  <h2 className="font-serif text-3xl text-neutral-900">
                    {activeListings.length} {activeListings.length === 1 ? 'Property' : 'Properties'} for Sale
                  </h2>
                </div>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeListings.map((listing, index) => (
                <ScrollReveal key={listing.id} delay={index * 100}>
                  <Link
                    href={`/listings/${listing.id}`}
                    className="group block"
                  >
                    <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden mb-6">
                      {listing.images[0] && (
                        <Image
                          src={listing.images[0]}
                          alt={listing.address}
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      )}
                      {/* Hover overlay with arrow */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                          <svg className="w-6 h-6 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="absolute top-4 left-4">
                        <span className="px-4 py-2 bg-[#d4a012] text-white text-xs uppercase tracking-[0.15em]">
                          For Sale
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="text-[#d4a012] text-xs uppercase tracking-[0.2em] mb-2">
                        {formatPrice(listing.price)}
                      </p>
                      <h3 className="font-serif text-xl text-neutral-900 group-hover:text-[#d4a012] transition-colors mb-1">
                        {listing.address}
                      </h3>
                      <p className="text-neutral-500 text-sm mb-4">{listing.city}</p>

                      <div className="flex items-center gap-6 text-sm text-neutral-600">
                        <span>{listing.bedrooms} Beds</span>
                        <span>{listing.bathrooms} Baths</span>
                        <span>{listing.sqft.toLocaleString()} Sqft</span>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Listings Section */}
        <section className="mb-24">
          <ScrollReveal>
            <div className="flex items-center gap-4 mb-12">
              <div>
                <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">Coming Soon</p>
                <h2 className="font-serif text-3xl text-neutral-900">
                  Upcoming Listings
                </h2>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <ScrollReveal delay={0}>
              <div className="bg-neutral-50 p-8 border border-neutral-200 hover:border-[#d4a012] transition-colors">
                <div className="mb-4">
                  <span className="px-3 py-1 bg-[#d4a012]/10 text-[#d4a012] text-xs uppercase tracking-[0.15em]">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-serif text-xl text-neutral-900 mb-2">Townhouse in Belmont</h3>
                <p className="text-neutral-500 text-sm mb-4">Belmont, CA</p>
                <div className="flex items-center gap-6 text-sm text-neutral-600">
                  <span>3 Beds</span>
                  <span>2.5 Baths</span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="bg-neutral-50 p-8 border border-neutral-200 hover:border-[#d4a012] transition-colors">
                <div className="mb-4">
                  <span className="px-3 py-1 bg-[#d4a012]/10 text-[#d4a012] text-xs uppercase tracking-[0.15em]">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-serif text-xl text-neutral-900 mb-2">Single Family in Belmont</h3>
                <p className="text-neutral-500 text-sm mb-4">Belmont, CA</p>
                <div className="flex items-center gap-6 text-sm text-neutral-600">
                  <span>3 Beds</span>
                  <span>1.5 Baths</span>
                </div>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="bg-neutral-50 p-8 border border-neutral-200 hover:border-[#d4a012] transition-colors">
                <div className="mb-4">
                  <span className="px-3 py-1 bg-[#d4a012]/10 text-[#d4a012] text-xs uppercase tracking-[0.15em]">
                    Coming Soon
                  </span>
                </div>
                <h3 className="font-serif text-xl text-neutral-900 mb-2">Single Family in San Francisco</h3>
                <p className="text-neutral-500 text-sm mb-4">San Francisco, CA</p>
                <div className="flex items-center gap-6 text-sm text-neutral-600">
                  <span>3 Beds</span>
                  <span>1 Bath</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Sold Listings Section */}
        <section>
          <ScrollReveal>
            <div className="flex items-center gap-4 mb-12">
              <div>
                <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">Closed Transactions</p>
                <h2 className="font-serif text-3xl text-neutral-900">
                  Successfully Sold Homes
                </h2>
              </div>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {soldListings.map((listing, index) => (
              <ScrollReveal key={listing.id} delay={(index % 3) * 100}>
                <Link
                  href={`/listings/${listing.id}`}
                  className="group block"
                >
                  <div className="aspect-[4/3] bg-neutral-100 relative overflow-hidden mb-6">
                    {listing.images[0] && (
                      <Image
                        src={listing.images[0]}
                        alt={listing.address}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    )}
                    {/* Hover overlay with arrow */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100">
                        <svg className="w-6 h-6 text-neutral-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-4 left-4">
                      <span className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-[0.15em]">
                        Sold
                      </span>
                    </div>

                    {/* Price Tag */}
                    <div className="absolute bottom-4 right-4">
                      <span className="px-4 py-2 bg-white text-neutral-900 text-sm font-medium">
                        {formatPrice(listing.price)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-serif text-xl text-neutral-900 group-hover:text-[#d4a012] transition-colors mb-1">
                      {listing.address}
                    </h3>
                    <p className="text-neutral-500 text-sm mb-3">{listing.city}</p>

                    {listing.soldDate && (
                      <p className="text-xs text-neutral-400 uppercase tracking-wider mb-4">
                        Sold {listing.soldDate}
                      </p>
                    )}

                    <div className="flex items-center gap-6 text-sm text-neutral-600">
                      <span>{listing.bedrooms} Beds</span>
                      <span>{listing.bathrooms} Baths</span>
                      <span>{listing.sqft.toLocaleString()} Sqft</span>
                    </div>
                  </div>
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </div>

      {/* CTA Section */}
      <section className="py-24 bg-[#eae6e1] relative overflow-hidden border-t border-neutral-200">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, #1a1a1a 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="max-w-4xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <ScrollReveal>
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-6">Ready to Get Started?</p>
            <h2 className="font-serif text-4xl md:text-5xl text-neutral-900 mb-6">
              Let&apos;s Find Your Perfect Home
            </h2>
            <div className="w-20 h-0.5 bg-[#d4a012] mx-auto mb-8" />
            <p className="text-neutral-500 mb-10 max-w-2xl mx-auto leading-relaxed">
              Whether you&apos;re buying your first home, selling a property, or exploring investment opportunities, I&apos;m here to support you every step of the way.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="px-10 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300"
              >
                Schedule a Free Consultation
              </Link>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
