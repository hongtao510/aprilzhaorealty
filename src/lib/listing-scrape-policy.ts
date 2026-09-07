import type { CityScrapeResult } from "@/lib/redfin-listings";

export function citiesSafeToStaleMark(
  results: CityScrapeResult[],
  upsertErrors: number,
): string[] {
  if (upsertErrors > 0) return [];
  return results
    .filter((result) => result.success && result.listings.length > 0)
    .map((result) => result.city);
}
