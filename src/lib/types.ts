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
  completedTransaction: boolean;
  content: string;
  createdAt: string;
}
