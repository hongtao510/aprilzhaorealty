import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getListing, getListings, formatPrice } from "@/lib/data";
import { CommentSection } from "@/components/CommentSection";

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
    <div>
      {/* Hero Image */}
      <section className="relative h-[50vh] md:h-[60vh] bg-gradient-to-br from-zinc-300 to-zinc-400">
        {listing.images[0] && (
          <Image
            src={listing.images[0]}
            alt={listing.address}
            fill
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        {/* Back button */}
        <Link
          href="/listings"
          className="absolute top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium hover:bg-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        {/* Status badge */}
        <div className="absolute top-6 right-6 z-10">
          {listing.status === "active" ? (
            <span className="px-4 py-2 bg-[#b1ff8f] text-[#381b5e] font-bold text-sm rounded-full">
              FOR SALE
            </span>
          ) : (
            <span className="px-4 py-2 bg-[#381b5e] text-white font-bold text-sm rounded-full">
              SOLD
            </span>
          )}
        </div>

        {/* Price overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">
              {listing.address}
            </h1>
            <p className="text-xl text-white/80">{listing.city}</p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid lg:grid-cols-3 gap-12">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Price and stats */}
            <div className="flex flex-wrap items-center gap-6 mb-8 pb-8 border-b border-zinc-100">
              <div>
                <p className="text-4xl font-bold text-[#381b5e]">
                  {formatPrice(listing.price)}
                </p>
                {listing.status === "sold" && listing.soldDate && (
                  <p className="text-sm text-zinc-500 mt-1">Sold on {listing.soldDate}</p>
                )}
              </div>
              <div className="flex gap-6 ml-auto">
                <div className="text-center">
                  <p className="text-2xl font-bold">{listing.bedrooms}</p>
                  <p className="text-sm text-zinc-500">Beds</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{listing.bathrooms}</p>
                  <p className="text-sm text-zinc-500">Baths</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{listing.sqft.toLocaleString()}</p>
                  <p className="text-sm text-zinc-500">Sq Ft</p>
                </div>
                {listing.yearBuilt && (
                  <div className="text-center">
                    <p className="text-2xl font-bold">{listing.yearBuilt}</p>
                    <p className="text-sm text-zinc-500">Built</p>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold mb-4">About This Property</h2>
              <p className="text-zinc-600 leading-relaxed text-lg">
                {listing.description}
              </p>
            </div>

            {/* Property Details */}
            {(listing.garage || listing.heating || listing.cooling || listing.hoaFees) && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Property Details</h2>
                <div className="grid grid-cols-2 gap-4">
                  {listing.garage && (
                    <div>
                      <p className="text-sm text-zinc-500">Parking</p>
                      <p className="font-medium">{listing.garage}</p>
                    </div>
                  )}
                  {listing.heating && (
                    <div>
                      <p className="text-sm text-zinc-500">Heating</p>
                      <p className="font-medium">{listing.heating}</p>
                    </div>
                  )}
                  {listing.cooling && (
                    <div>
                      <p className="text-sm text-zinc-500">Cooling</p>
                      <p className="font-medium">{listing.cooling}</p>
                    </div>
                  )}
                  {listing.hoaFees && (
                    <div>
                      <p className="text-sm text-zinc-500">HOA Fees</p>
                      <p className="font-medium">${listing.hoaFees}/month</p>
                    </div>
                  )}
                  {listing.mlsNumber && (
                    <div>
                      <p className="text-sm text-zinc-500">MLS #</p>
                      <p className="font-medium">{listing.mlsNumber}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Features */}
            {listing.features && listing.features.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Features</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {listing.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-zinc-600">
                      <div className="w-2 h-2 bg-[#b1ff8f] rounded-full" />
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Appliances */}
            {listing.appliances && listing.appliances.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Appliances</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {listing.appliances.map((appliance, i) => (
                    <div key={i} className="flex items-center gap-2 text-zinc-600">
                      <div className="w-2 h-2 bg-[#c181ff] rounded-full" />
                      {appliance}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schools */}
            {listing.schools && (listing.schools.elementary || listing.schools.highSchool) && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-4">Schools</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listing.schools.elementary && (
                    <div>
                      <p className="text-sm text-zinc-500">Elementary District</p>
                      <p className="font-medium">{listing.schools.elementary}</p>
                    </div>
                  )}
                  {listing.schools.highSchool && (
                    <div>
                      <p className="text-sm text-zinc-500">High School District</p>
                      <p className="font-medium">{listing.schools.highSchool}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comments */}
            <CommentSection listingId={listing.id} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              {/* Agent card */}
              <div className="bg-zinc-50 rounded-3xl p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#c181ff] to-[#5e74ff] rounded-full" />
                  <div>
                    <p className="font-bold text-lg">April Zhao</p>
                    <p className="text-sm text-zinc-500">Real Estate Agent</p>
                  </div>
                </div>
                <p className="text-sm text-zinc-600 mb-6">
                  Interested in this property? I&apos;d love to help you schedule a viewing or answer any questions.
                </p>
                <Link
                  href="/contact"
                  className="block w-full py-4 bg-[#381b5e] text-white font-semibold rounded-xl text-center hover:bg-[#4a2578] transition-all hover:shadow-lg hover:shadow-purple-500/25"
                >
                  Contact April
                </Link>
              </div>

              {/* Quick actions */}
              <div className="space-y-3">
                <button className="w-full py-3 border-2 border-zinc-200 rounded-xl font-medium hover:border-[#c181ff] transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Save Listing
                </button>
                <button className="w-full py-3 border-2 border-zinc-200 rounded-xl font-medium hover:border-[#c181ff] transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
                {listing.mlsLink && (
                  <a
                    href={listing.mlsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 border-2 border-zinc-200 rounded-xl font-medium hover:border-[#c181ff] transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    View on MLS
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
