import type { RawComp, ScrapeResult } from "./types";

const MAX_COMPS = 20;
const SCRAPE_TIMEOUT = 20_000; // 20s total for all scraping attempts

// Approximate bounding boxes for zip codes (lat/long).
// We use a ~2-mile radius around the zip code center.
// For unknown zips, we geocode on the fly using Redfin's autocomplete.
const ZIP_BOUNDS: Record<string, { south: number; north: number; west: number; east: number }> = {
  // Pre-cached SF Peninsula + Silicon Valley zips (~2mi radius around center)
  "94002": { south: 37.495, north: 37.535, west: -122.305, east: -122.245 }, // Belmont
  "94010": { south: 37.555, north: 37.595, west: -122.380, east: -122.320 }, // Burlingame
  "94014": { south: 37.665, north: 37.705, west: -122.440, east: -122.380 }, // Daly City / Colma
  "94015": { south: 37.660, north: 37.700, west: -122.500, east: -122.440 }, // Daly City
  "94025": { south: 37.430, north: 37.490, west: -122.220, east: -122.150 }, // Menlo Park
  "94027": { south: 37.430, north: 37.470, west: -122.220, east: -122.180 }, // Atherton
  "94030": { south: 37.580, north: 37.620, west: -122.400, east: -122.340 }, // Millbrae
  "94061": { south: 37.450, north: 37.490, west: -122.260, east: -122.200 }, // Redwood City
  "94062": { south: 37.420, north: 37.480, west: -122.300, east: -122.230 }, // Redwood City / Emerald Hills
  "94063": { south: 37.470, north: 37.510, west: -122.230, east: -122.170 }, // Redwood City
  "94065": { south: 37.520, north: 37.555, west: -122.270, east: -122.230 }, // Redwood Shores
  "94066": { south: 37.610, north: 37.650, west: -122.460, east: -122.400 }, // San Bruno
  "94070": { south: 37.485, north: 37.525, west: -122.290, east: -122.230 }, // San Carlos
  "94080": { south: 37.625, north: 37.685, west: -122.460, east: -122.400 }, // South San Francisco
  "94401": { south: 37.555, north: 37.585, west: -122.340, east: -122.300 }, // San Mateo (downtown)
  "94402": { south: 37.520, north: 37.555, west: -122.360, east: -122.300 }, // San Mateo (west)
  "94403": { south: 37.510, north: 37.550, west: -122.345, east: -122.285 }, // San Mateo (east/Hillsdale)
  "94404": { south: 37.540, north: 37.580, west: -122.290, east: -122.230 }, // Foster City
  "94301": { south: 37.430, north: 37.470, west: -122.180, east: -122.120 }, // Palo Alto
  "94303": { south: 37.430, north: 37.480, west: -122.150, east: -122.080 }, // East Palo Alto / Palo Alto
  "94304": { south: 37.385, north: 37.435, west: -122.200, east: -122.140 }, // Palo Alto (Stanford)
  "94306": { south: 37.400, north: 37.440, west: -122.160, east: -122.100 }, // Palo Alto
  "94022": { south: 37.350, north: 37.400, west: -122.140, east: -122.080 }, // Los Altos
  "94024": { south: 37.330, north: 37.380, west: -122.130, east: -122.070 }, // Los Altos
  "94040": { south: 37.355, north: 37.400, west: -122.110, east: -122.050 }, // Mountain View
  "94041": { south: 37.370, north: 37.410, west: -122.100, east: -122.040 }, // Mountain View
  "94043": { south: 37.395, north: 37.440, west: -122.110, east: -122.040 }, // Mountain View
  "94087": { south: 37.330, north: 37.370, west: -122.060, east: -121.990 }, // Sunnyvale
  "94089": { south: 37.395, north: 37.435, west: -122.050, east: -121.980 }, // Sunnyvale
  "94085": { south: 37.370, north: 37.405, west: -122.050, east: -121.985 }, // Sunnyvale
  "94086": { south: 37.355, north: 37.395, west: -122.060, east: -121.985 }, // Sunnyvale
  "95014": { south: 37.305, north: 37.345, west: -122.080, east: -122.000 }, // Cupertino
  "95051": { south: 37.330, north: 37.370, west: -121.990, east: -121.930 }, // Santa Clara
  "95129": { south: 37.300, north: 37.340, west: -122.000, east: -121.940 }, // San Jose (West)
  "95070": { south: 37.250, north: 37.290, west: -122.060, east: -121.990 }, // Saratoga
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

  // Fall back to zippopotam.us — free, no auth, returns lat/lng for US zips
  try {
    info(`Looking up coordinates for zip ${zip} via zippopotam.us...`);
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; aprilzhaorealty/1.0)",
      },
    });

    if (!res.ok) {
      info(`Zippopotam returned ${res.status} for zip ${zip}`);
      return null;
    }

    const data = await res.json();
    const place = data?.places?.[0];
    if (!place?.latitude || !place?.longitude) {
      info(`No coordinates in zippopotam response for zip ${zip}`);
      return null;
    }

    const lat = parseFloat(place.latitude);
    const lng = parseFloat(place.longitude);
    // ~2 mile radius in degrees
    const latDelta = 0.029;
    const lngDelta = 0.036;
    const bounds = {
      south: lat - latDelta,
      north: lat + latDelta,
      west: lng - lngDelta,
      east: lng + lngDelta,
    };
    info(`Found coordinates for zip ${zip}: ${lat}, ${lng}`);
    return bounds;
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

      const property_type = (cols[2] ?? "").trim() || null;
      const sold_date = parseRedfinDate(cols[1] ?? "");
      const address = `${cols[3] ?? ""}, ${cols[4] ?? ""}, ${cols[5] ?? ""} ${cols[6] ?? ""}`.trim();
      const sold_price = parseFloat((cols[7] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const beds = parseInt(cols[8] ?? "0") || 0;
      const baths = parseFloat(cols[9] ?? "0") || 0;
      const sqft = parseFloat((cols[11] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const lot_sqft_raw = parseFloat((cols[12] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const year_built_raw = parseInt(cols[13] ?? "");
      const redfin_url = cols[20] ?? "";
      const lat = parseFloat(cols[25] ?? "");
      const lng = parseFloat(cols[26] ?? "");

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
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          property_type,
          year_built: Number.isFinite(year_built_raw) && year_built_raw > 1800 ? year_built_raw : null,
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
