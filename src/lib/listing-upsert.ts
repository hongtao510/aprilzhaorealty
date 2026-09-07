import type { RedfinListing } from "@/lib/redfin-listings";

export function buildListingUpsertRow(
  listing: RedfinListing,
  existingUrls: ReadonlySet<string>,
  seenAt: string,
) {
  return {
    redfin_url: listing.redfin_url,
    address: listing.address,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    sqft: listing.sqft,
    lot_sqft: listing.lot_sqft,
    year_built: listing.year_built,
    price_per_sqft: listing.price_per_sqft,
    hoa_per_month: listing.hoa_per_month,
    property_type: listing.property_type,
    status: listing.status,
    days_on_market: listing.days_on_market,
    mls_number: listing.mls_number,
    latitude: listing.latitude,
    longitude: listing.longitude,
    last_seen_at: seenAt,
    is_new: !existingUrls.has(listing.redfin_url),
  };
}
