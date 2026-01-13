import { Listing } from "@/lib/types";

// Site-wide structured data for the real estate agent
export function AgentStructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "RealEstateAgent",
        "@id": "https://aprilzhaohome.com/#agent",
        name: "April Zhao",
        url: "https://aprilzhaohome.com",
        logo: "https://aprilzhaohome.com/images/logo.png",
        image: "https://aprilzhaohome.com/images/april-zhao.jpg",
        description:
          "Your trusted real estate partner in the San Francisco Bay Area. Expert guidance for buying and selling homes in San Jose, San Mateo, Belmont, Redwood City, and surrounding areas.",
        email: "aprilcasf@gmail.com",
        areaServed: [
          {
            "@type": "City",
            name: "San Jose",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "San Mateo",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Belmont",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Redwood City",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "San Carlos",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Palo Alto",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Sunnyvale",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Santa Clara",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Los Altos",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Foster City",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "Millbrae",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
          {
            "@type": "City",
            name: "San Francisco",
            containedInPlace: {
              "@type": "State",
              name: "California",
            },
          },
        ],
        address: {
          "@type": "PostalAddress",
          addressLocality: "San Jose",
          addressRegion: "CA",
          addressCountry: "US",
        },
        priceRange: "$1M - $4M+",
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "5",
          reviewCount: "23",
        },
        makesOffer: [
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Home Buying Services",
              description:
                "Expert guidance for finding and purchasing your perfect home in the Bay Area.",
            },
          },
          {
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: "Home Selling Services",
              description:
                "Professional marketing and negotiation to sell your home for top dollar.",
            },
          },
        ],
        memberOf: {
          "@type": "Organization",
          name: "BQ Realty",
        },
        knowsAbout: [
          "Bay Area Real Estate",
          "Residential Property Sales",
          "Home Buying",
          "Home Selling",
          "Property Valuation",
          "Market Analysis",
        ],
        sameAs: [
          "https://www.linkedin.com/in/aprilzhao",
          "https://www.instagram.com/aprilzhaohome",
          "https://www.facebook.com/aprilzhaohome",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://aprilzhaohome.com/#website",
        url: "https://aprilzhaohome.com",
        name: "April Zhao | Bay Area Real Estate Agent",
        description:
          "Your trusted real estate partner in the San Francisco Bay Area.",
        publisher: {
          "@id": "https://aprilzhaohome.com/#agent",
        },
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": "https://aprilzhaohome.com/#organization",
        name: "April Zhao Realty",
        url: "https://aprilzhaohome.com",
        logo: {
          "@type": "ImageObject",
          url: "https://aprilzhaohome.com/images/logo.png",
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: "aprilcasf@gmail.com",
          contactType: "sales",
          areaServed: "San Francisco Bay Area",
          availableLanguage: ["English", "Chinese"],
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Structured data for individual listing pages
export function ListingStructuredData({ listing }: { listing: Listing }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${listing.address}, ${listing.city}`,
    description: listing.description,
    url: `https://aprilzhaohome.com/listings/${listing.id}`,
    datePosted: listing.soldDate,
    image:
      listing.images.length > 0
        ? listing.images[0].startsWith("/")
          ? `https://aprilzhaohome.com${listing.images[0]}`
          : listing.images[0]
        : undefined,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: "USD",
      availability:
        listing.status === "sold"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: listing.address,
      addressLocality: listing.city.split(",")[0].trim(),
      addressRegion: "CA",
      postalCode: listing.city.split(" ").pop(),
      addressCountry: "US",
    },
    numberOfRooms: listing.bedrooms + (listing.bathrooms || 0),
    numberOfBedrooms: listing.bedrooms,
    numberOfBathroomsTotal: listing.bathrooms,
    floorSize: {
      "@type": "QuantitativeValue",
      value: listing.sqft,
      unitCode: "SQF",
    },
    yearBuilt: listing.yearBuilt,
    propertyType: listing.propertyType,
    broker: {
      "@type": "RealEstateAgent",
      name: "April Zhao",
      url: "https://aprilzhaohome.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

// Breadcrumb structured data
export function BreadcrumbStructuredData({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItemListElement",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}
