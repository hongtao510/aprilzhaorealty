/**
 * Redfin Listings Scraper
 *
 * Scrapes active for-sale listings from Redfin's stingray CSV API
 * for the 12 featured cities. Used by the daily cron job.
 */

export interface RedfinListing {
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  lot_sqft: number | null;
  year_built: number | null;
  price_per_sqft: number | null;
  hoa_per_month: number | null;
  property_type: string;
  status: string;
  days_on_market: number | null;
  mls_number: string;
  redfin_url: string;
  latitude: number | null;
  longitude: number | null;
}

export interface CityConfig {
  name: string;
  south: number;
  north: number;
  west: number;
  east: number;
}

/** The 12 featured cities with bounding boxes for the Redfin API. */
export const FEATURED_CITIES: CityConfig[] = [
  { name: "San Francisco", south: 37.708, north: 37.812, west: -122.515, east: -122.355 },
  { name: "Millbrae",      south: 37.588, north: 37.610, west: -122.420, east: -122.380 },
  { name: "Burlingame",    south: 37.560, north: 37.600, west: -122.395, east: -122.340 },
  { name: "Hillsborough",  south: 37.540, north: 37.575, west: -122.390, east: -122.335 },
  { name: "San Mateo",     south: 37.530, north: 37.580, west: -122.345, east: -122.280 },
  { name: "Belmont",       south: 37.495, north: 37.535, west: -122.305, east: -122.245 },
  { name: "San Carlos",    south: 37.488, north: 37.520, west: -122.280, east: -122.240 },
  { name: "Foster City",   south: 37.540, north: 37.570, west: -122.280, east: -122.240 },
  { name: "Redwood Shores",south: 37.525, north: 37.545, west: -122.265, east: -122.235 },
  { name: "Redwood City",  south: 37.455, north: 37.510, west: -122.280, east: -122.195 },
  { name: "Menlo Park",    south: 37.430, north: 37.475, west: -122.210, east: -122.145 },
  { name: "Palo Alto",     south: 37.380, north: 37.460, west: -122.190, east: -122.110 },
];

/**
 * Build bounding-box polygon string for the Redfin stingray API.
 */
function buildPoly(city: CityConfig): string {
  const { south, north, west, east } = city;
  return `${west} ${south},${east} ${south},${east} ${north},${west} ${north},${west} ${south}`;
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
 * Scrape active for-sale listings for a single city from Redfin's CSV API.
 */
export async function scrapeListingsForCity(
  city: CityConfig,
  log?: (msg: string) => void,
): Promise<RedfinListing[]> {
  const info = log ?? console.log;
  const poly = buildPoly(city);

  // status=1 = active/for-sale, uipt=1 = single family homes
  // Also include uipt=2 (condos/townhomes) for broader coverage
  const csvUrl = `https://www.redfin.com/stingray/api/gis-csv?al=1&num_homes=100&ord=days-on-redfin-asc&page_number=1&status=1&uipt=1,2,3&v=8&poly=${encodeURIComponent(poly)}`;

  info(`Scraping ${city.name}...`);

  const response = await fetch(csvUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": "https://www.redfin.com/",
    },
  });

  if (!response.ok) {
    throw new Error(`Redfin API returned ${response.status} for ${city.name}`);
  }

  const csvText = await response.text();

  // Check for JSON error
  if (csvText.startsWith("{}&&")) {
    const errJson = JSON.parse(csvText.replace(/^{}&&/, ""));
    throw new Error(`Redfin API error for ${city.name}: ${errJson.errorMessage || "Unknown"}`);
  }

  const lines = csvText.split("\n").filter((line) => line.startsWith("MLS Listing"));
  const listings: RedfinListing[] = [];

  for (const line of lines) {
    try {
      // CSV columns:
      // 0: SALE TYPE, 1: SOLD DATE, 2: PROPERTY TYPE, 3: ADDRESS, 4: CITY,
      // 5: STATE, 6: ZIP, 7: PRICE, 8: BEDS, 9: BATHS, 10: LOCATION,
      // 11: SQFT, 12: LOT SIZE, 13: YEAR BUILT, 14: DAYS ON MARKET,
      // 15: $/SQFT, 16: HOA/MONTH, 17: STATUS, 18: OPEN HOUSE START,
      // 19: OPEN HOUSE END, 20: URL, 21: SOURCE, 22: MLS#,
      // 23: FAVORITE, 24: INTERESTED, 25: LATITUDE, 26: LONGITUDE
      const cols = parseCSVLine(line);

      const price = parseFloat((cols[7] ?? "0").replace(/[^0-9.]/g, "")) || 0;
      const sqft = parseFloat((cols[11] ?? "0").replace(/[^0-9.]/g, "")) || 0;

      if (!cols[3] || price <= 0) continue;

      listings.push({
        address: cols[3] ?? "",
        city: cols[4] ?? city.name,
        state: cols[5] ?? "CA",
        zip: cols[6] ?? "",
        price,
        beds: parseInt(cols[8] ?? "0") || 0,
        baths: parseFloat(cols[9] ?? "0") || 0,
        sqft,
        lot_sqft: parseFloat((cols[12] ?? "0").replace(/[^0-9.]/g, "")) || null,
        year_built: parseInt(cols[13] ?? "0") || null,
        price_per_sqft: parseFloat((cols[15] ?? "0").replace(/[^0-9.]/g, "")) || null,
        hoa_per_month: parseFloat((cols[16] ?? "0").replace(/[^0-9.]/g, "")) || null,
        property_type: cols[2] ?? "Single Family Residential",
        status: (cols[17] ?? "Active").toLowerCase(),
        days_on_market: parseInt(cols[14] ?? "") || null,
        mls_number: cols[22] ?? "",
        redfin_url: cols[20] ?? "",
        latitude: parseFloat(cols[25] ?? "") || null,
        longitude: parseFloat(cols[26] ?? "") || null,
      });
    } catch {
      // Skip unparseable lines
    }
  }

  info(`${city.name}: ${listings.length} active listings`);
  return listings;
}

/**
 * Scrape all 12 featured cities. Returns all listings grouped.
 */
export async function scrapeAllCities(
  log?: (msg: string) => void,
): Promise<{ city: string; listings: RedfinListing[] }[]> {
  const info = log ?? console.log;
  const results: { city: string; listings: RedfinListing[] }[] = [];

  for (const city of FEATURED_CITIES) {
    try {
      const listings = await scrapeListingsForCity(city, log);
      results.push({ city: city.name, listings });
    } catch (err) {
      info(`ERROR scraping ${city.name}: ${err instanceof Error ? err.message : String(err)}`);
      results.push({ city: city.name, listings: [] });
    }

    // Small delay between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const total = results.reduce((sum, r) => sum + r.listings.length, 0);
  info(`Total: ${total} listings across ${results.length} cities`);
  return results;
}
