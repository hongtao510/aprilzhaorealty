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
