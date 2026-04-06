import type { RawComp, ScrapeResult } from "./types";

const MAX_COMPS = 20;
const SCRAPE_TIMEOUT = 20_000; // 20s total for all scraping attempts

// Approximate bounding boxes for zip codes (lat/long).
// We use a ~2-mile radius around the zip code center.
// For unknown zips, we geocode on the fly using Redfin's autocomplete.
const ZIP_BOUNDS: Record<string, { south: number; north: number; west: number; east: number }> = {
  // Pre-cached for known areas (add more as needed)
  "94002": { south: 37.495, north: 37.535, west: -122.305, east: -122.245 }, // Belmont, CA
};

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Build a bounding-box polygon string for the Redfin stingray API.
 * Format: "lon1 lat1,lon2 lat2,lon3 lat3,lon4 lat4,lon1 lat1"
 */
function buildPolyParam(bounds: { south: number; north: number; west: number; east: number }): string {
  const { south, north, west, east } = bounds;
  return `${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}`;
}

/**
 * Get bounding box for a zip code. Uses pre-cached values or falls back to
 * a simple center-point estimate from Redfin's autocomplete.
 */
async function getBoundsForZip(
  zip: string,
  log?: (msg: string) => void,
): Promise<{ south: number; north: number; west: number; east: number } | null> {
  const info = log ?? console.log;

  // Check pre-cached bounds first
  if (ZIP_BOUNDS[zip]) {
    return ZIP_BOUNDS[zip];
  }

  // Try Redfin autocomplete to get lat/long for the zip, then build a ~2mi box
  try {
    info(`Looking up coordinates for zip ${zip}...`);
    const res = await fetch(
      `https://www.redfin.com/stingray/do/location-autocomplete?location=${zip}&v=2`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        },
      },
    );

    if (!res.ok) {
      info(`Autocomplete API returned ${res.status}`);
      return null;
    }

    const text = await res.text();
    // Response format: {}&&{...json...}
    const jsonStr = text.replace(/^{}&&/, "");
    const data = JSON.parse(jsonStr);

    // Look for a matching zip code result
    const sections = data?.payload?.sections ?? [];
    for (const section of sections) {
      for (const row of section.rows ?? []) {
        if (row.id && row.lat && row.lng) {
          const lat = row.lat;
          const lng = row.lng;
          // ~2 mile radius in degrees (approx)
          const latDelta = 0.029; // ~2 miles
          const lngDelta = 0.036; // ~2 miles at ~37° latitude
          const bounds = {
            south: lat - latDelta,
            north: lat + latDelta,
            west: lng - lngDelta,
            east: lng + lngDelta,
          };
          info(`Found coordinates for zip ${zip}: ${lat}, ${lng}`);
          return bounds;
        }
      }
    }

    info(`No coordinates found for zip ${zip}`);
    return null;
  } catch (err) {
    info(`Geocode failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/**
 * Parse a Redfin CSV date like "January-28-2026" or "March-6-2026" into YYYY-MM-DD.
 */
function parseRedfinDate(dateStr: string): string {
  if (!dateStr) return "";
  // Format: "Month-DD-YYYY"
  const cleaned = dateStr.replace(/-/g, " ");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/**
 * Primary scraper: use Redfin's stingray CSV API.
 * This is the same API that Redfin's website uses to power the "Download All" button.
 * It returns structured CSV data with real sold prices — free, no API key needed.
 */
export async function scrapeWithRedfinApi(
  zip: string,
  log?: (msg: string) => void,
): Promise<RawComp[]> {
  const info = log ?? console.log;

  const bounds = await getBoundsForZip(zip, log);
  if (!bounds) {
    throw new Error(`Could not determine coordinates for zip ${zip}`);
  }

  const poly = buildPolyParam(bounds);
  const csvUrl = `https://www.redfin.com/stingray/api/gis-csv?al=1&num_homes=${MAX_COMPS + 10}&ord=days-on-redfin-asc&page_number=1&sold_within_days=365&status=9&uipt=1&v=8&poly=${encodeURIComponent(poly)}`;

  info(`Fetching Redfin CSV API for zip ${zip}...`);

  const response = await fetch(csvUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": `https://www.redfin.com/zipcode/${zip}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redfin CSV API returned ${response.status}`);
  }

  const csvText = await response.text();

  // Check for JSON error response (starts with {}&&)
  if (csvText.startsWith("{}&&")) {
    const errJson = JSON.parse(csvText.replace(/^{}&&/, ""));
    throw new Error(`Redfin API error: ${errJson.errorMessage || "Unknown"}`);
  }

  const lines = csvText.split("\n").filter((line) => line.startsWith("PAST SALE"));
  info(`Redfin CSV returned ${lines.length} sold properties`);

  const comps: RawComp[] = [];

  for (const line of lines) {
    try {
      // CSV columns (from header):
      // SALE TYPE, SOLD DATE, PROPERTY TYPE, ADDRESS, CITY, STATE, ZIP, PRICE,
      // BEDS, BATHS, LOCATION, SQUARE FEET, LOT SIZE, YEAR BUILT, DAYS ON MARKET,
      // $/SQUARE FEET, HOA/MONTH, STATUS, NEXT OPEN HOUSE START, NEXT OPEN HOUSE END,
      // URL, SOURCE, MLS#, FAVORITE, INTERESTED, LATITUDE, LONGITUDE
      const cols = parseCSVLine(line);

      const sold_date = parseRedfinDate(cols[1] ?? "");
      const address = `${cols[3] ?? ""}, ${cols[4] ?? ""}, ${cols[5] ?? ""} ${cols[6] ?? ""}`.trim();
      const sold_price = parseFloat((cols[7] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const beds = parseInt(cols[8] ?? "0") || 0;
      const baths = parseFloat(cols[9] ?? "0") || 0;
      const sqft = parseFloat((cols[11] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const lot_sqft_raw = parseFloat((cols[12] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const redfin_url = cols[20] ?? "";

      if (address && sold_price > 0 && sqft > 0) {
        comps.push({
          address,
          sold_price,
          sold_date,
          sqft,
          beds,
          baths,
          lot_sqft: lot_sqft_raw > 0 ? lot_sqft_raw : null,
          redfin_url,
        });
      }
    } catch {
      // Skip unparseable lines
    }
  }

  info(`Parsed ${comps.length} valid comps from Redfin CSV`);
  return comps.slice(0, MAX_COMPS);
}

/**
 * Parse a CSV line handling quoted fields with commas.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Main entry point: scrape recently sold comps for a zip code.
 * Fallback chain: Redfin CSV API → empty (caller uses Claude knowledge).
 * Overall timeout: 20 seconds for all attempts combined.
 */
export async function scrapeComps(
  zip: string,
  log?: (msg: string) => void,
): Promise<ScrapeResult> {
  const info = log ?? console.log;

  async function tryAll(): Promise<ScrapeResult> {
    // 1. Try Redfin stingray CSV API (primary — free, works everywhere)
    try {
      info("Attempting Redfin CSV API (primary)...");
      const comps = await scrapeWithRedfinApi(zip, log);
      if (comps.length > 0) {
        info(`Redfin API: ${comps.length} comps scraped successfully`);
        return { comps, source: "redfin-api" as ScrapeResult["source"] };
      }
      info("Redfin API returned 0 results");
    } catch (err) {
      info(`Redfin API failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 2. All scrapers failed
    info("All scrapers failed — will fall back to Claude knowledge (unverified)");
    return { comps: [], source: "claude-knowledge" };
  }

  // Wrap entire pipeline in a timeout
  try {
    return await withTimeout(tryAll(), SCRAPE_TIMEOUT, "Scraping pipeline");
  } catch (err) {
    info(`Scraping timed out: ${err instanceof Error ? err.message : String(err)}`);
    return { comps: [], source: "claude-knowledge" };
  }
}
