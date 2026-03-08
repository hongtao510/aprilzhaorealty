const RENTCAST_BASE = "https://api.rentcast.io/v1";

function getApiKey(): string {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error("RENTCAST_API_KEY is not set in .env.local");
  return key;
}

async function rentcastFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${RENTCAST_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": getApiKey() },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RentCast API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface RentCastProperty {
  id: string;
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  county: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  features?: Record<string, unknown>;
  taxAssessments?: Record<string, { value: number; land: number; improvements: number }>;
  owner?: { names: string[]; type: string };
}

export interface RentCastAVMResult {
  price: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  pricePerSquareFoot: number;
  subjectProperty: {
    id: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    bedrooms: number;
    bathrooms: number;
    squareFootage: number;
    yearBuilt: number;
    lastSaleDate: string | null;
    lastSalePrice: number | null;
  };
  comparables: RentCastComparable[];
}

export interface RentCastComparable {
  id: string;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  lotSize: number;
  yearBuilt: number;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  distance: number;
  correlation: number;
  price: number;
}

export interface RentCastMarketStats {
  zipCode: string;
  saleSummary?: {
    averagePrice?: number;
    medianPrice?: number;
    averagePricePerSquareFoot?: number;
    averageDaysOnMarket?: number;
    totalListings?: number;
  };
  trends?: Record<string, unknown>;
}

// --- API Functions ---

/**
 * Get property record by address. Returns the first matching property.
 */
export async function getPropertyRecord(address: string): Promise<RentCastProperty | null> {
  try {
    const results = await rentcastFetch<RentCastProperty[]>("/properties", {
      address,
      limit: "1",
    });
    return results?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get AVM value estimate with comparable properties.
 */
export async function getValueEstimate(
  address: string,
  opts?: { propertyType?: string; compCount?: number }
): Promise<RentCastAVMResult | null> {
  try {
    const params: Record<string, string> = { address };
    if (opts?.propertyType) params.propertyType = opts.propertyType;
    if (opts?.compCount) params.compCount = String(opts.compCount);
    return await rentcastFetch<RentCastAVMResult>("/avm/value", params);
  } catch {
    return null;
  }
}

/**
 * Get market statistics for a zip code.
 */
export async function getMarketStatistics(zipCode: string): Promise<RentCastMarketStats | null> {
  try {
    return await rentcastFetch<RentCastMarketStats>("/markets", { zipCode });
  } catch {
    return null;
  }
}
