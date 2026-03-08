const SIMPLYRETS_BASE = "https://api.simplyrets.com";

function getCredentials(): { username: string; password: string } {
  const username = process.env.SIMPLYRETS_USERNAME;
  const password = process.env.SIMPLYRETS_PASSWORD;
  if (!username || !password) {
    throw new Error("SIMPLYRETS_USERNAME or SIMPLYRETS_PASSWORD is not set");
  }
  return { username, password };
}

async function simplyRetsFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const { username, password } = getCredentials();
  const url = new URL(`${SIMPLYRETS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SimplyRETS API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Types ---

export interface SimplyRetsListing {
  mlsId: number;
  listingId: string;
  listPrice: number;
  listDate: string;
  modified: string;
  address: {
    full: string;
    streetNumberText: string;
    streetName: string;
    streetSuffix: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    unit: string | null;
  };
  property: {
    area: number;
    bedrooms: number;
    bathrooms: number;
    bathsFull: number;
    bathsHalf: number;
    lotSize: string;
    lotSizeArea: number | null;
    lotSizeAreaUnits: string | null;
    acres: number | null;
    type: string;
    subType: string | null;
    yearBuilt: number;
    style: string;
    stories: number | null;
    garageSpaces: number | null;
    parking: { spaces: number | null; description: string | null };
    pool: string | null;
    interiorFeatures: string | null;
    exteriorFeatures: string | null;
    subdivision: string | null;
  };
  sales: {
    closeDate: string | null;
    closePrice: number | null;
    contractDate: string | null;
    agent: { firstName: string; lastName: string } | null;
    office: { name: string } | null;
  };
  mls: {
    status: string;
    area: string;
    daysOnMarket: number;
    statusText: string;
  };
  geo: {
    lat: number;
    lng: number;
    county: string | null;
    marketArea: string | null;
  };
  photos: string[];
  remarks: string | null;
  virtualTourUrl: string | null;
  tax: {
    taxYear: number | null;
    taxAnnualAmount: number | null;
  } | null;
}

// --- API Functions ---

export interface ClosedListingsQuery {
  city?: string;
  postalCode?: string;
  state?: string;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  minArea?: number;
  maxArea?: number;
  type?: string;
  limit?: number;
  sort?: string;
  vendor?: string;
}

/**
 * Search for recently closed/sold listings.
 * Requires SimplyRETS Premium plan for status=Closed.
 */
export async function getClosedListings(query: ClosedListingsQuery): Promise<SimplyRetsListing[]> {
  const params: Record<string, string> = {
    status: "Closed",
    limit: String(query.limit ?? 50),
    sort: query.sort ?? "-closedate",
  };

  if (query.city) params.cities = query.city;
  if (query.postalCode) params.postalCodes = query.postalCode;
  if (query.state) params.state = query.state;
  if (query.minBeds !== undefined) params.minbeds = String(query.minBeds);
  if (query.maxBeds !== undefined) params.maxbeds = String(query.maxBeds);
  if (query.minBaths !== undefined) params.minbaths = String(query.minBaths);
  if (query.maxBaths !== undefined) params.maxbaths = String(query.maxBaths);
  if (query.minArea !== undefined) params.minarea = String(query.minArea);
  if (query.maxArea !== undefined) params.maxarea = String(query.maxArea);
  if (query.type) params.type = query.type;
  if (query.vendor) params.vendor = query.vendor;

  return simplyRetsFetch<SimplyRetsListing[]>("/properties", params);
}

/**
 * Look up a single listing by MLS ID.
 */
export async function getListingById(mlsId: number): Promise<SimplyRetsListing | null> {
  try {
    return await simplyRetsFetch<SimplyRetsListing>(`/properties/${mlsId}`, {});
  } catch {
    return null;
  }
}

/**
 * Get market analytics for a set of search filters.
 * Requires Market Analytics add-on ($40/mo).
 */
export async function getListingsAnalytics(query: ClosedListingsQuery): Promise<unknown> {
  const params: Record<string, string> = {};
  if (query.city) params.cities = query.city;
  if (query.postalCode) params.postalCodes = query.postalCode;
  if (query.state) params.state = query.state;
  if (query.type) params.type = query.type;

  try {
    return await simplyRetsFetch<unknown>("/properties/analytics", params);
  } catch {
    return null;
  }
}
