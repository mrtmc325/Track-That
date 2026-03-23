// Inter-Service Contract: Vendor Adapter → Elasticsearch
// This defines the indexed document shape in Elasticsearch
// Per operability.observability_by_default — last_updated tracked for staleness monitoring

export interface StoreListingDocument {
  store_id: string;
  store_name: string;
  current_price: number;
  on_sale: boolean;
  location: {
    lat: number;
    lon: number;
  };
  last_updated: string; // ISO 8601
}

export interface ProductDocument {
  product_id: string;
  canonical_name: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  store_listings: StoreListingDocument[];
}

// Scrape result before normalization
export interface RawScrapedProduct {
  source_url: string;
  store_id: string;
  raw_name: string;
  raw_price: string;
  raw_category?: string;
  image_url?: string;
  on_sale?: boolean;
  scraped_at: string;
}

// Normalized result ready for DB/ES write
export interface NormalizedProduct {
  canonical_name: string;
  brand: string;
  category: string;
  subcategory: string;
  unit_of_measure: string;
  description: string;
  image_urls: string[];
  confidence: number; // 0.0-1.0 match confidence against catalog
}
