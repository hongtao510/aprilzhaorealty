export interface Listing {
  id: string;
  address: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  status: "active" | "sold" | "pending";
  images: string[];
  description: string;
  yearBuilt?: number;
  soldDate?: string;
  propertyType?: string;
  mlsLink?: string;
  mlsNumber?: string;
  videoLink?: string;
  zillowLink?: string;
  hoaFees?: number;
  garage?: string;
  heating?: string;
  cooling?: string;
  features?: string[];
  appliances?: string[];
  schools?: {
    elementary?: string;
    highSchool?: string;
  };
}

export interface Comment {
  id: string;
  listingId: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  email?: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "client";
  created_at: string;
  updated_at: string;
}

export interface Material {
  id: string;
  client_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedHome {
  id: string;
  client_id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  address: string | null;
  price: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedHomePreview {
  title: string | null;
  image_url: string | null;
  address: string | null;
  price: string | null;
}

export interface CandidateHome {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  address: string | null;
  price: string | null;
  price_numeric: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lot_sqft: number | null;
  year_built: number | null;
  property_type: string | null;
  latitude: number | null;
  longitude: number | null;
  valuation: number | null;
  valuation_low: number | null;
  valuation_high: number | null;
  status: "new" | "saved" | "sent" | "dismissed";
  source: "redfin" | "manual";
  search_criteria_id: string | null;
  sent_to_client_id: string | null;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchCriteria {
  id: string;
  label: string;
  region_id: string;
  region_type: number;
  min_price: number | null;
  max_price: number | null;
  property_types: string[] | null;
  min_beds: number | null;
  min_baths: number | null;
  is_active: boolean;
}

export interface CompHome {
  address: string;
  sold_price: number;
  sold_date: string;
  sqft: number;
  beds: number;
  baths: number;
  lot_sqft: number;
  similarity_score: number;
  price_per_sqft: number;
  reason: string;
  redfin_url?: string;
  distance_miles?: number;
}

export interface CompsEstimate {
  weighted_price_per_sqft: number;
  comp_based: number;
  trend_adjusted: number;
  market_temperature: "hot" | "warm" | "cool";
  trend_adjustment_pct: number;
  range: {
    most_likely: [number, number];
    likely: [number, number];
    possible: [number, number];
    unlikely_below: number;
    unlikely_above: number;
  };
}

export interface CompsMarketSignals {
  sale_to_list_ratio: string;
  days_on_market: number;
  yoy_change: string;
  mom_change: string;
}

export interface CompsResult {
  comps: CompHome[];
  subject: {
    address: string;
    sqft: number;
    beds: number;
    baths: number;
    lot_sqft: number;
  };
  estimate: CompsEstimate;
  market_signals: CompsMarketSignals;
  reasoning: string;
}

export interface CandidateComp {
  id: string;
  candidate_home_id: string;
  comps: CompsResult;
  price_estimate: number | null;
  price_range_low: number | null;
  price_range_high: number | null;
  market_temperature: "hot" | "warm" | "cool" | null;
  reasoning: string | null;
  raw_response: string | null;
  created_at: string;
}
