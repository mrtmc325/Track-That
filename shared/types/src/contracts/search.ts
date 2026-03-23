// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// API Contract: GET /api/v1/search
// Per security.validate_all_untrusted_input — all query params validated with Zod before use

export interface SearchQuery {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;     // miles, default 25, max 50
  category?: string;
  page?: number;        // default 1
  page_size?: number;   // default 20, max 50
}

export interface ProductSummary {
  id: string;
  name: string;
  category: string;
  brand: string;
  image_url: string;
  description: string;
}

export interface BestPrice {
  store_name: string;
  price: number;
  distance_miles: number;
  on_sale: boolean;
  coupon_available: boolean;
}

export interface StoreListing {
  store_id: string;
  store_name: string;
  price: number;
  original_price: number;
  distance_miles: number;
  store_rating: number;
}

export interface SearchResult {
  product: ProductSummary;
  best_price: BestPrice;
  listings: StoreListing[];
}

export interface SearchMetadata {
  normalized_query: string;
  fuzzy_applied: boolean;
  response_time_ms: number;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
  similar_items: SearchResult[];
  search_metadata: SearchMetadata;
}

// Autocomplete
export interface SuggestQuery {
  q: string;
}

export interface SuggestResponse {
  suggestions: string[];
}
