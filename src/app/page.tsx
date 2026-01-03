"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { getListings, formatPrice } from "@/lib/data";

export default function Home() {
  const allListings = getListings();
  // Filter listings that have images for the carousel
  const listingsWithImages = allListings.filter((listing) => listing.images.length > 0);
  const carouselListings = listingsWithImages.slice(0, 8); // Show up to 8 listings in carousel
  const recentListings = allListings.slice(0, 6);

  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % carouselListings.length);
  }, [carouselListings.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + carouselListings.length) % carouselListings.length);
  }, [carouselListings.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Optional auto-advance (can be disabled by removing this useEffect)
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <div>
      {/* Hero Section - Elegant and Professional */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-purple-50">
        {/* Subtle decorative elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[#381b5e]/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white to-transparent" />

        {/* Decorative circles - more subtle */}
        <div className="absolute top-32 right-20 w-64 h-64 bg-[#c181ff]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-32 right-1/3 w-96 h-96 bg-[#5e74ff]/5 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#381b5e]/5 border border-[#381b5e]/10 text-[#381b5e] text-sm font-medium rounded-full mb-8">
                <span className="w-2 h-2 bg-[#b1ff8f] rounded-full animate-pulse" />
                Bay Area Real Estate Expert
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-zinc-900">
                Your Trusted Partner in
                <span className="block mt-2 gradient-text">Bay Area Real Estate</span>
              </h1>

              {/* Subheadline */}
              <p className="text-lg text-zinc-600 max-w-lg mb-10 leading-relaxed">
                With deep local expertise and a commitment to personalized service, I help families find their perfect home in the San Francisco Bay Area.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/listings"
                  className="group px-7 py-4 bg-[#381b5e] text-white font-semibold rounded-xl hover:bg-[#4a2578] transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 hover:-translate-y-0.5 flex items-center gap-2"
                >
                  View Listings
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="px-7 py-4 bg-white border-2 border-zinc-200 text-zinc-800 font-semibold rounded-xl hover:border-[#381b5e] hover:text-[#381b5e] transition-all duration-300"
                >
                  Get in Touch
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="mt-12 pt-8 border-t border-zinc-200">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Trusted by Homeowners</p>
                <div className="flex items-center gap-6">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-[#c181ff] to-[#5e74ff] border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-zinc-900">23+ Families</span>
                    <span className="text-zinc-500"> found their dream home</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Image Carousel */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10">
                {/* Carousel Container */}
                <div className="aspect-[4/5] relative">
                  {carouselListings.map((listing, index) => (
                    <div
                      key={listing.id}
                      className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                        index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                      }`}
                    >
                      <Image
                        src={listing.images[0]}
                        alt={listing.address}
                        fill
                        className="object-cover"
                        priority={index === 0}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    </div>
                  ))}

                  {/* Navigation Arrows */}
                  <button
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105"
                    aria-label="Previous slide"
                  >
                    <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105"
                    aria-label="Next slide"
                  >
                    <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Overlay content - Property Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                    <div className="inline-block px-3 py-1 bg-[#b1ff8f] text-[#381b5e] text-xs font-bold rounded-full mb-3">
                      RECENTLY SOLD
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {carouselListings[currentSlide]?.address}
                    </h3>
                    <p className="text-white/80 text-sm mb-2">
                      {carouselListings[currentSlide]?.city}
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatPrice(carouselListings[currentSlide]?.price || 0)}
                    </p>
                  </div>

                  {/* Dot Indicators */}
                  <div className="absolute bottom-6 right-6 z-20 flex gap-2">
                    {carouselListings.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                          index === currentSlide
                            ? "bg-[#b1ff8f] w-8"
                            : "bg-white/50 hover:bg-white/80"
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar - Clean horizontal display below hero */}
      <section className="py-8 bg-white border-y border-zinc-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex flex-wrap justify-center md:justify-between items-center gap-8 md:gap-4">
            <div className="flex items-center gap-3 px-6">
              <div className="w-12 h-12 bg-[#381b5e]/5 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#381b5e]">22+</p>
                <p className="text-sm text-zinc-500">Homes Sold</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-zinc-200" />

            <div className="flex items-center gap-3 px-6">
              <div className="w-12 h-12 bg-[#381b5e]/5 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#381b5e]">$57M+</p>
                <p className="text-sm text-zinc-500">Total Volume</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-zinc-200" />

            <div className="flex items-center gap-3 px-6">
              <div className="w-12 h-12 bg-[#381b5e]/5 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#381b5e]">10+</p>
                <p className="text-sm text-zinc-500">Years Experience</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-zinc-200" />

            <div className="flex items-center gap-3 px-6">
              <div className="w-12 h-12 bg-[#381b5e]/5 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-[#381b5e]">5.0</p>
                <p className="text-sm text-zinc-500">Client Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Clean and Impactful */}
      <section className="py-20 bg-[#381b5e] relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Proven Track Record
            </h2>
            <p className="text-purple-200 max-w-2xl mx-auto">
              Numbers that reflect dedication, expertise, and successful partnerships with Bay Area families
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4 group-hover:bg-[#b1ff8f]/20 transition-colors">
                <svg className="w-8 h-8 text-[#b1ff8f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-4xl md:text-5xl font-bold text-white mb-2">23</p>
              <p className="text-purple-200 text-sm">Successful Closings</p>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4 group-hover:bg-[#c181ff]/20 transition-colors">
                <svg className="w-8 h-8 text-[#c181ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-4xl md:text-5xl font-bold text-white mb-2">$57.6M</p>
              <p className="text-purple-200 text-sm">Total Volume</p>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4 group-hover:bg-[#5e74ff]/20 transition-colors">
                <svg className="w-8 h-8 text-[#5e74ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <p className="text-4xl md:text-5xl font-bold text-white mb-2">$2.5M</p>
              <p className="text-purple-200 text-sm">Average Sale Price</p>
            </div>
            <div className="text-center group">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4 group-hover:bg-[#ff771c]/20 transition-colors">
                <svg className="w-8 h-8 text-[#ff771c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-4xl md:text-5xl font-bold text-white mb-2">21</p>
              <p className="text-purple-200 text-sm">Deals (Last 2 Years)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Listings - Modern Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-14">
            <div>
              <span className="inline-block text-sm font-semibold text-[#381b5e] uppercase tracking-wider mb-3">Portfolio</span>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-900">Featured Properties</h2>
              <p className="text-zinc-600 mt-3 max-w-lg">
                Browse through recently sold homes showcasing successful transactions across the Bay Area
              </p>
            </div>
            <Link
              href="/listings"
              className="group inline-flex items-center gap-2 text-[#381b5e] font-semibold hover:gap-3 transition-all"
            >
              View All Listings
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentListings.map((listing) => (
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
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#381b5e] text-white text-xs font-semibold rounded-lg shadow-lg">
                      <span className="w-1.5 h-1.5 bg-[#b1ff8f] rounded-full" />
                      SOLD
                    </span>
                  </div>

                  {/* Price Tag */}
                  <div className="absolute bottom-4 right-4 z-10">
                    <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-[#381b5e] text-sm font-bold rounded-lg shadow-lg">
                      {formatPrice(listing.price)}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-lg text-zinc-900 group-hover:text-[#381b5e] transition-colors mb-1">
                    {listing.address}
                  </h3>
                  <p className="text-zinc-500 text-sm mb-4">{listing.city}</p>

                  {/* Property Details */}
                  <div className="flex items-center gap-4 pt-4 border-t border-zinc-100">
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span className="font-medium">{listing.bedrooms}</span> bd
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                      </svg>
                      <span className="font-medium">{listing.bathrooms}</span> ba
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-zinc-600">
                      <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                      <span className="font-medium">{listing.sqft.toLocaleString()}</span> sqft
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services/Why Choose Section */}
      <section className="py-24 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block text-sm font-semibold text-[#381b5e] uppercase tracking-wider mb-3">Why Work With Me</span>
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
              A Different Approach to Real Estate
            </h2>
            <p className="text-zinc-600 max-w-2xl mx-auto">
              Experience personalized service backed by deep market knowledge and a genuine commitment to your success
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-2xl p-8 border border-zinc-100 hover:border-[#c181ff]/30 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-[#381b5e]/5 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">Local Expertise</h3>
              <p className="text-zinc-600 leading-relaxed">
                Deep knowledge of Bay Area neighborhoods, schools, and market trends to help you make informed decisions.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-zinc-100 hover:border-[#c181ff]/30 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-[#381b5e]/5 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">Personalized Service</h3>
              <p className="text-zinc-600 leading-relaxed">
                Every client receives dedicated attention and a customized strategy tailored to their unique needs and goals.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-zinc-100 hover:border-[#c181ff]/30 hover:shadow-lg transition-all duration-300">
              <div className="w-14 h-14 bg-[#381b5e]/5 rounded-xl flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-[#381b5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3">Trusted Guidance</h3>
              <p className="text-zinc-600 leading-relaxed">
                Transparent communication and honest advice throughout your real estate journey, from search to closing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Elegant and Professional */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-[#381b5e] via-[#4a2578] to-[#381b5e]">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-10 left-10 w-72 h-72 bg-[#c181ff]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#5e74ff]/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-block px-4 py-2 bg-white/10 text-[#b1ff8f] text-sm font-semibold rounded-full mb-6">
            Ready to Get Started?
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
            Let&apos;s Find Your
            <span className="block">Perfect Home Together</span>
          </h2>
          <p className="text-lg text-purple-200 mb-10 max-w-2xl mx-auto leading-relaxed">
            Whether you&apos;re buying your first home, selling a property, or exploring investment opportunities, I&apos;m here to guide you every step of the way.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/contact"
              className="group px-8 py-4 bg-[#b1ff8f] text-[#381b5e] font-bold rounded-xl hover:bg-[#c5ff9f] transition-all duration-300 hover:shadow-xl hover:shadow-[#b1ff8f]/25 hover:-translate-y-0.5 flex items-center gap-2"
            >
              Schedule a Consultation
              <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <Link
              href="/listings"
              className="px-8 py-4 bg-transparent border-2 border-white/30 text-white font-semibold rounded-xl hover:bg-white/10 hover:border-white/50 transition-all duration-300"
            >
              Browse Listings
            </Link>
          </div>

          {/* Contact info */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-purple-200 text-sm mb-2">Or reach out directly</p>
            <a href="mailto:aprilcasf@gmail.com" className="text-white font-medium hover:text-[#b1ff8f] transition-colors">
              aprilcasf@gmail.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
