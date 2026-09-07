import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorizedCronRequest } from "../src/lib/cron-auth";
import { escapeHtml } from "../src/lib/email-templates";
import { citiesSafeToStaleMark } from "../src/lib/listing-scrape-policy";
import { buildListingUpsertRow } from "../src/lib/listing-upsert";
import type { RedfinListing } from "../src/lib/redfin-listings";
import { safeRedirectPath } from "../src/lib/safe-redirect";
import { pageMetadata } from "../src/lib/site-metadata";

test("redirect validation permits local paths and rejects external targets", () => {
  assert.equal(safeRedirectPath("/portal?tab=homes", "/portal"), "/portal?tab=homes");
  assert.equal(safeRedirectPath("https://evil.example", "/portal"), "/portal");
  assert.equal(safeRedirectPath("//evil.example", "/portal"), "/portal");
  assert.equal(safeRedirectPath("/@evil.example", "/portal"), "/@evil.example");
  assert.equal(safeRedirectPath("/\\evil.example", "/portal"), "/portal");
});

test("cron authorization fails closed when the secret is absent", () => {
  assert.equal(isAuthorizedCronRequest("Bearer undefined", undefined), false);
  assert.equal(isAuthorizedCronRequest(null, "secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer wrong", "secret"), false);
  assert.equal(isAuthorizedCronRequest("Bearer secret", "secret"), true);
});

test("stale marking requires complete, non-empty scrape coverage", () => {
  const successful = { city: "Belmont", listings: [{} as RedfinListing], success: true };
  const failed = { city: "San Mateo", listings: [], success: false, error: "timeout" };
  const empty = { city: "San Carlos", listings: [], success: true };
  assert.deepEqual(citiesSafeToStaleMark([successful, failed, empty], 0), ["Belmont"]);
  assert.deepEqual(citiesSafeToStaleMark([successful], 1), []);
});

test("listing upserts preserve the database-managed first-seen timestamp", () => {
  const listing: RedfinListing = {
    address: "1 Main St",
    city: "Belmont",
    state: "CA",
    zip: "94002",
    price: 1_000_000,
    beds: 3,
    baths: 2,
    sqft: 1500,
    lot_sqft: 5000,
    year_built: 1960,
    price_per_sqft: 667,
    hoa_per_month: null,
    property_type: "Single Family Residential",
    status: "active",
    days_on_market: 2,
    mls_number: "ML1",
    redfin_url: "https://www.redfin.com/example",
    latitude: 37.5,
    longitude: -122.3,
  };
  const row = buildListingUpsertRow(
    listing,
    new Set([listing.redfin_url]),
    "2026-09-07T00:00:00.000Z"
  );
  assert.equal(row.is_new, false);
  assert.equal("first_seen_at" in row, false);
  assert.equal(row.last_seen_at, "2026-09-07T00:00:00.000Z");
});

test("email HTML escaping neutralizes markup", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
  );
});

test("page metadata emits a route-specific canonical URL", () => {
  const metadata = pageMetadata({
    title: "Listings",
    description: "Available homes",
    path: "/listings",
  });
  assert.equal(String(metadata.alternates?.canonical), "https://aprilzhaohome.com/listings");
  assert.equal(metadata.openGraph?.url, "https://aprilzhaohome.com/listings");
});
