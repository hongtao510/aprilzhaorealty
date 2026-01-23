"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { getListings, formatPrice, getTestimonials } from "@/lib/data";
import ScrollReveal from "@/components/ScrollReveal";

// Bay Area neighborhoods data
const neighborhoods = [
  {
    name: "San Carlos",
    description: "Family-friendly with excellent schools",
    url: "https://www.redfin.com/city/16687/CA/San-Carlos",
    image: "/images/neighborhoods/san-carlos.jpg",
  },
  {
    name: "Belmont",
    description: "Charming hillside community",
    url: "https://www.redfin.com/city/1362/CA/Belmont",
    image: "/images/neighborhoods/belmont.jpg",
  },
  {
    name: "Palo Alto",
    description: "Tech hub with top schools",
    url: "https://www.redfin.com/city/14325/CA/Palo-Alto",
    image: "/images/neighborhoods/palo-alto.jpg",
  },
  {
    name: "Burlingame",
    description: "Boutique downtown & tree-lined streets",
    url: "https://www.redfin.com/city/2350/CA/Burlingame",
    image: "/images/neighborhoods/burlingame.jpg",
  },
  {
    name: "San Francisco",
    description: "Iconic city with diverse neighborhoods",
    url: "https://www.redfin.com/city/17151/CA/San-Francisco",
    image: "https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=800&q=80",
  },
];

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

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <div>
      {/* Hero Section - Full viewport with image carousel background */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        {/* Full-screen image carousel background */}
        <div className="absolute inset-0">
          {carouselListings.map((listing, index) => (
            <div
              key={listing.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? "opacity-100" : "opacity-0"
              }`}
            >
              <Image
                src={listing.images[0]}
                alt={listing.address}
                fill
                className="object-cover"
                priority={index === 0}
              />
            </div>
          ))}
          {/* Dark overlay for text legibility */}
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full pb-32 md:pb-24">
          <div className="max-w-3xl">
            {/* Small tagline */}
            <p className="text-[#d4a012] text-sm uppercase tracking-[0.3em] mb-6">
              Bay Area Real Estate
            </p>

            {/* Main headline - serif font */}
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-normal text-white mb-6 leading-[1.1]">
              Find Your Perfect
              <span className="block">Home in the</span>
              <span className="text-[#d4a012]">Bay Area</span>
            </h1>

            {/* Bio */}
            <p className="text-lg text-white/80 max-w-xl mb-10 leading-relaxed">
              Peninsula-based real estate professional with deep local expertise and a data-driven approach. From A to Z, April is here to guide you throughout your buying or selling journey.
            </p>

            {/* CTA Buttons - border style inspired by Dana Carmel */}
            <div className="flex flex-wrap gap-4">
              <Link
                href="/listings"
                className="px-8 py-4 bg-white text-neutral-900 text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#d4a012] hover:text-white transition-all duration-300"
              >
                View Listings
              </Link>
              <Link
                href="/testimonials"
                className="px-8 py-4 border-2 border-white text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-white hover:text-neutral-900 transition-all duration-300"
              >
                Testimonials
              </Link>
              <Link
                href="/contact"
                className="px-8 py-4 border-2 border-white text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-white hover:text-neutral-900 transition-all duration-300"
              >
                Schedule a Consultation
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar with property info and carousel navigation */}
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex justify-between items-end">
            {/* Current property info */}
            <div>
              <p className="text-[#d4a012] text-xs uppercase tracking-[0.2em] mb-2">Recently Sold</p>
              <p className="text-white text-base md:text-lg font-medium">{carouselListings[currentSlide]?.address}</p>
              <p className="text-white/70 text-sm">{carouselListings[currentSlide]?.city}</p>
            </div>

            {/* Carousel Navigation */}
            <div className="flex items-center gap-3 md:gap-4">
              <button
                onClick={prevSlide}
                className="w-10 h-10 md:w-12 md:h-12 border border-white/50 text-white hover:bg-white hover:text-neutral-900 transition-all duration-300 flex items-center justify-center"
                aria-label="Previous slide"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-white text-xs md:text-sm tracking-wider min-w-[60px] text-center">
                <span className="text-[#d4a012]">{String(currentSlide + 1).padStart(2, '0')}</span>
                <span className="mx-1 md:mx-2">/</span>
                <span>{String(carouselListings.length).padStart(2, '0')}</span>
              </div>
              <button
                onClick={nextSlide}
                className="w-10 h-10 md:w-12 md:h-12 border border-white/50 text-white hover:bg-white hover:text-neutral-900 transition-all duration-300 flex items-center justify-center"
                aria-label="Next slide"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Listings - Elegant grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <ScrollReveal>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-16">
              <div>
                <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">Portfolio</p>
                <h2 className="font-serif text-4xl md:text-5xl text-neutral-900">Featured Properties</h2>
                <div className="w-20 h-0.5 bg-[#d4a012] mt-6" />
              </div>
              <Link
                href="/listings"
                className="group inline-flex items-center gap-3 text-neutral-900 text-sm uppercase tracking-[0.15em] font-medium hover:text-[#d4a012] transition-colors"
              >
                View All
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </ScrollReveal>

          {/* Listings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {recentListings.map((listing, index) => (
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
                      <span className="px-4 py-2 bg-neutral-900 text-white text-xs uppercase tracking-[0.15em]">
                        Sold
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

                    {/* Property Details */}
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
        </div>
      </section>

      {/* Neighborhoods Section - Dana Carmel Inspired */}
      <section className="py-24 bg-neutral-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-16">
              <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-4">Explore</p>
              <h2 className="font-serif text-4xl md:text-5xl text-neutral-900 mb-4">Bay Area Neighborhoods</h2>
              <div className="w-20 h-0.5 bg-[#d4a012] mx-auto" />
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {neighborhoods.map((neighborhood, index) => (
              <ScrollReveal key={neighborhood.name} delay={index * 100}>
                <a
                  href={neighborhood.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-[3/4] overflow-hidden cursor-pointer block"
                >
                  {/* Background Image */}
                  <Image
                    src={neighborhood.image}
                    alt={neighborhood.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:from-black/90 transition-all duration-300" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6">
                    <h3 className="font-serif text-2xl text-white mb-2 group-hover:text-[#d4a012] transition-colors">
                      {neighborhood.name}
                    </h3>
                    <p className="text-white/80 text-sm">{neighborhood.description}</p>

                    {/* Arrow icon on hover */}
                    <div className="mt-4 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                      <span className="inline-flex items-center gap-2 text-[#d4a012] text-xs uppercase tracking-widest font-medium">
                        View on Redfin
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* Decorative border on hover */}
                  <div className="absolute inset-4 border border-white/0 group-hover:border-white/30 transition-colors duration-300" />
                </a>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-neutral-900 relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px'}} />
        </div>

        <div className="max-w-4xl mx-auto px-6 lg:px-8 relative z-10 text-center">
          <ScrollReveal>
            <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-6">Ready to Get Started?</p>
            <h2 className="font-serif text-4xl md:text-5xl text-white mb-6">
              Let&apos;s Find Your Perfect Home
            </h2>
            <div className="w-20 h-0.5 bg-[#d4a012] mx-auto mb-8" />
            <p className="text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Whether you&apos;re buying your first home, selling a property, or exploring investment opportunities, I&apos;m here to guide you every step of the way.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="px-10 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300"
              >
                Schedule a Consultation
              </Link>
              <Link
                href="/listings"
                className="px-10 py-4 border-2 border-white/30 text-white text-xs font-medium uppercase tracking-[0.15em] hover:border-white hover:bg-white hover:text-neutral-900 transition-all duration-300"
              >
                Browse Listings
              </Link>
            </div>

            {/* Contact info */}
            <div className="mt-16 pt-8 border-t border-white/10">
              <p className="text-neutral-500 text-xs uppercase tracking-[0.2em] mb-2">Or reach out directly</p>
              <a href="mailto:aprilcasf@gmail.com" className="text-white hover:text-[#d4a012] transition-colors">
                aprilcasf@gmail.com
              </a>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
