// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Search Service — in-memory product search engine.
 * In production, this delegates to Elasticsearch.
 * For dev/testing, uses in-memory store with the same interface.
 *
 * operability.observability_by_default — logs search queries with timing
 * scalability.performance_budgets_as_contracts — tracks response_time_ms
 */
import { processQuery, type ProcessedQuery } from './query-processor.js';
import { logger } from '../utils/logger.js';

export interface ProductDocument {
  product_id: string;
  canonical_name: string;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  image_url: string;
  store_listings: {
    store_id: string;
    store_name: string;
    current_price: number;
    original_price: number;
    on_sale: boolean;
    store_rating: number;
    location: { lat: number; lon: number };
    last_updated: string;
  }[];
}

export interface SearchResultItem {
  product: {
    id: string;
    name: string;
    category: string;
    brand: string;
    image_url: string;
    description: string;
  };
  best_price: {
    store_name: string;
    price: number;
    distance_miles: number;
    on_sale: boolean;
    coupon_available: boolean;
  };
  listings: {
    store_id: string;
    store_name: string;
    price: number;
    original_price: number;
    distance_miles: number;
    store_rating: number;
  }[];
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResultItem[];
  similar_items: SearchResultItem[];
  search_metadata: {
    normalized_query: string;
    fuzzy_applied: boolean;
    response_time_ms: number;
  };
}

export interface SearchParams {
  q: string;
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  page?: number;
  pageSize?: number;
}

// In-memory product store (replaced by Elasticsearch in production)
const products = new Map<string, ProductDocument>();

/**
 * Calculate Haversine distance in miles between two coordinates.
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Score how well a product matches a processed query.
 * Higher score = better match.
 */
function scoreMatch(product: ProductDocument, processed: ProcessedQuery): number {
  const name = product.canonical_name.toLowerCase();
  const desc = product.description.toLowerCase();
  const brand = product.brand.toLowerCase();
  let score = 0;

  // Check all synonyms + original tokens
  const allTerms = processed.synonyms;

  for (const term of allTerms) {
    // Exact name match (highest weight)
    if (name === term) { score += 100; continue; }
    // Name contains term
    if (name.includes(term)) score += 50;
    // Brand match
    if (brand.includes(term)) score += 30;
    // Description match
    if (desc.includes(term)) score += 10;
  }

  // Category bonus
  if (processed.tokens.some(t =>
    product.category.toLowerCase().includes(t) ||
    product.subcategory.toLowerCase().includes(t)
  )) {
    score += 20;
  }

  return score;
}

/**
 * Transform a matched product into a SearchResultItem.
 */
function toResultItem(product: ProductDocument, userLat?: number, userLng?: number): SearchResultItem {
  const listings = product.store_listings.map(sl => {
    const distance = (userLat !== undefined && userLng !== undefined)
      ? Math.round(haversineDistance(userLat, userLng, sl.location.lat, sl.location.lon) * 10) / 10
      : 0;
    return {
      store_id: sl.store_id,
      store_name: sl.store_name,
      price: sl.current_price,
      original_price: sl.original_price,
      distance_miles: distance,
      store_rating: sl.store_rating,
    };
  });

  // Sort by price ascending
  listings.sort((a, b) => a.price - b.price);

  const best = listings[0];
  return {
    product: {
      id: product.product_id,
      name: product.canonical_name,
      category: product.category,
      brand: product.brand,
      image_url: product.image_url,
      description: product.description,
    },
    best_price: {
      store_name: best?.store_name || 'Unknown',
      price: best?.price || 0,
      distance_miles: best?.distance_miles || 0,
      on_sale: product.store_listings[0]?.on_sale || false,
      coupon_available: false, // Populated by price engine in production
    },
    listings,
  };
}

/**
 * Execute a search query.
 * Full pipeline: validate → normalize → search → rank → return.
 * Supports category-only browsing (no query required).
 */
export function search(params: SearchParams): SearchResponse | { error: { code: string; message: string } } {
  const startTime = Date.now();

  // Category-only browse: skip query processing, return all products in category
  if ((!params.q || params.q.trim().length < 2) && params.category) {
    return browseCategoryOnly(params, startTime);
  }

  // Process query through pipeline
  const processed = processQuery(params.q);
  if ('error' in processed) {
    return {
      error: {
        code: processed.error.errorCode || 'INVALID_QUERY',
        message: processed.error.error || 'Invalid search query',
      },
    };
  }

  const query = processed.result;
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50); // Max 50 per spec

  // Score all products against query
  const scored: { product: ProductDocument; score: number }[] = [];
  for (const product of products.values()) {
    // Category filter
    if (params.category && product.category.toLowerCase() !== params.category.toLowerCase()) {
      continue;
    }

    const score = scoreMatch(product, query);
    if (score > 0) {
      // Distance filter
      if (params.lat !== undefined && params.lng !== undefined && params.radius) {
        const hasNearbyStore = product.store_listings.some(sl =>
          haversineDistance(params.lat!, params.lng!, sl.location.lat, sl.location.lon) <= params.radius!
        );
        if (!hasNearbyStore) continue;
      }
      scored.push({ product, score });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Paginate
  const offset = (page - 1) * pageSize;
  const pageResults = scored.slice(offset, offset + pageSize);

  // Build results
  const results = pageResults.map(s => toResultItem(s.product, params.lat, params.lng));

  // Similar items fallback (when no exact results or fuzzy was applied)
  let similar_items: SearchResultItem[] = [];
  if (results.length === 0 || query.fuzzyRequired) {
    // Find partial matches using individual tokens
    const partialScored: { product: ProductDocument; score: number }[] = [];
    for (const product of products.values()) {
      const name = product.canonical_name.toLowerCase();
      const partialScore = query.tokens.reduce((s, t) => s + (name.includes(t) ? 10 : 0), 0);
      if (partialScore > 0 && !scored.find(s => s.product.product_id === product.product_id)) {
        partialScored.push({ product, score: partialScore });
      }
    }
    partialScored.sort((a, b) => b.score - a.score);
    similar_items = partialScored.slice(0, 5).map(s => toResultItem(s.product, params.lat, params.lng));
  }

  const responseTimeMs = Date.now() - startTime;

  logger.info('search.query', 'Search completed', {
    query: query.normalized,
    results_count: scored.length,
    response_time_ms: responseTimeMs,
    fuzzy_applied: query.fuzzyRequired,
    page,
  });

  return {
    query: params.q,
    total_results: scored.length,
    results,
    similar_items,
    search_metadata: {
      normalized_query: query.normalized,
      fuzzy_applied: query.fuzzyRequired,
      response_time_ms: responseTimeMs,
    },
  };
}

/**
 * Browse products by category only (no search query).
 * Returns all products matching the category, sorted by name.
 */
function browseCategoryOnly(params: SearchParams, startTime: number): SearchResponse {
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);

  const matched: { product: ProductDocument; score: number }[] = [];
  for (const product of products.values()) {
    if (params.category && product.category.toLowerCase() !== params.category.toLowerCase()) continue;

    // Distance filter
    if (params.lat !== undefined && params.lng !== undefined && params.radius) {
      const hasNearbyStore = product.store_listings.some(sl =>
        haversineDistance(params.lat!, params.lng!, sl.location.lat, sl.location.lon) <= params.radius!
      );
      if (!hasNearbyStore) continue;
    }

    matched.push({ product, score: 1 });
  }

  matched.sort((a, b) => a.product.canonical_name.localeCompare(b.product.canonical_name));

  const offset = (page - 1) * pageSize;
  const pageResults = matched.slice(offset, offset + pageSize);
  const results = pageResults.map(m => toResultItem(m.product, params.lat, params.lng));

  const responseTimeMs = Date.now() - startTime;

  logger.info('search.browse', 'Category browse completed', {
    category: params.category,
    results_count: matched.length,
    response_time_ms: responseTimeMs,
  });

  return {
    query: params.category || '',
    total_results: matched.length,
    results,
    similar_items: [],
    search_metadata: {
      normalized_query: params.category || '',
      fuzzy_applied: false,
      response_time_ms: responseTimeMs,
    },
  };
}

/**
 * Search with real-time crawling.
 * Calls vendor-adapter to crawl nearby stores, indexes results, then runs search.
 * Falls back to local search if crawl fails or times out.
 */
export async function searchWithCrawl(
  params: SearchParams,
  authenticated: boolean = false,
): Promise<SearchResponse | { error: { code: string; message: string } }> {
  // Always trigger crawl when user has location set and a search query.
  // Anti-detection (UA rotation, header randomization) is ALWAYS ON for all crawls.
  // Authenticated users additionally get proxy-URL routing if PROXY_URL is configured.
  if (params.q && params.q.length >= 2 && params.lat !== undefined && params.lng !== undefined) {
    try {
      logger.info('search.crawl_trigger', 'Triggering crawl with anti-detection', {
        query: params.q,
        authenticated,
      });
      const crawlResponse = await fetch('http://vendor-service:3007/api/v1/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.q,
          lat: params.lat,
          lng: params.lng,
          radius: params.radius || 25,
        }),
        signal: AbortSignal.timeout(55000), // 55s — wait for stealth crawl to complete
      });

      if (crawlResponse.ok) {
        const crawlData = await crawlResponse.json() as { success: boolean; data: { products: ProductDocument[] } };
        if (crawlData.success && crawlData.data.products.length > 0) {
          // Index crawled products into our in-memory store
          for (const product of crawlData.data.products) {
            indexProduct(product);
          }
          logger.info('search.crawl_indexed', `Indexed ${crawlData.data.products.length} products from crawl`, {
            query: params.q,
            products_indexed: crawlData.data.products.length,
          });
        }
      }
    } catch (err) {
      // Crawl failed or timed out — fall back to existing data
      logger.warning('search.crawl_failed', `Crawl failed, using cached data: ${(err as Error).message}`, {
        query: params.q,
      });
    }
  }

  // Run the normal search against whatever products we have (cached + newly crawled)
  return search(params);
}

/**
 * Autocomplete suggestions.
 * Returns product names matching the prefix.
 */
export function suggest(query: string, limit: number = 10): string[] {
  if (!query || query.trim().length < 2) return [];

  const normalized = query.toLowerCase().trim();
  const suggestions = new Set<string>();

  for (const product of products.values()) {
    if (product.canonical_name.toLowerCase().startsWith(normalized)) {
      suggestions.add(product.canonical_name);
    }
    if (suggestions.size >= limit) break;
  }

  // Second pass: contains match
  if (suggestions.size < limit) {
    for (const product of products.values()) {
      if (product.canonical_name.toLowerCase().includes(normalized)) {
        suggestions.add(product.canonical_name);
      }
      if (suggestions.size >= limit) break;
    }
  }

  return Array.from(suggestions);
}

/**
 * Get product by ID.
 */
export function getProduct(id: string): ProductDocument | null {
  return products.get(id) || null;
}

/**
 * Get all categories.
 */
export function getCategories(): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const product of products.values()) {
    counts.set(product.category, (counts.get(product.category) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Index a product (used by vendor adapter and tests) */
export function indexProduct(doc: ProductDocument): void {
  products.set(doc.product_id, doc);
}

/** Remove a product from the index */
export function removeProduct(id: string): boolean {
  return products.delete(id);
}

/** Clear all products (testing) */
export function _resetProducts(): void {
  products.clear();
}
