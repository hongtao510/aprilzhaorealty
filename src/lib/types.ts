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
}

export interface Comment {
  id: string;
  listingId: string;
  author: string;
  content: string;
  createdAt: string;
}
