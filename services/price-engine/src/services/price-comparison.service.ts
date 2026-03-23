// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Price Comparison Service
 * Per Phase 5 spec: consumes product listings, applies coupons, scores, ranks.
 * This is the orchestrator that ties scoring + coupons + staleness together.
 *
 * operability.observability_by_default — logs comparisons with timing
 * scalability.performance_budgets_as_contracts — tracked response times
 */
import { scoreListings, calculateEffectivePrice, type ListingInput, type ScoredListing } from './scoring.service.js';
import { classifyFreshness, shouldIncludeInResults, type PriceFreshness } from './staleness.service.js';
import { findApplicableCoupons, bestCouponDiscount } from './coupon.service.js';
import { logger } from '../utils/logger.js';

export interface StoreListing {
  store_id: string;
  store_name: string;
  price: number;
  original_price: number;
  on_sale: boolean;
  distance_miles: number;
  store_rating: number;
  last_scraped: Date;
  location: { lat: number; lon: number };
}

export interface ProductForComparison {
  product_id: string;
  canonical_name: string;
  category: string;
  brand: string;
  image_url: string;
  description: string;
  store_listings: StoreListing[];
}

export interface ComparisonResult {
  product_id: string;
  product_name: string;
  category: string;
  brand: string;
  listings: {
    store_id: string;
    store_name: string;
    price: number;
    effective_price: number;
    original_price: number;
    on_sale: boolean;
    coupon_applied: boolean;
    coupon_code: string | null;
    coupon_discount: number;
    distance_miles: number;
    store_rating: number;
    freshness: PriceFreshness;
    deal_score: number;
  }[];
  best_deal: {
    store_name: string;
    effective_price: number;
    deal_score: number;
    savings_vs_highest: number;
  } | null;
  comparison_metadata: {
    total_listings: number;
    excluded_expired: number;
    response_time_ms: number;
  };
}

// In-memory product store for dev (Elasticsearch/PostgreSQL in production)
const products = new Map<string, ProductForComparison>();

// Simple TTL cache for comparisons
const comparisonCache = new Map<string, { result: ComparisonResult; expires: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes per spec

/**
 * Compare prices for a product across all stores.
 * Full pipeline: filter expired → apply coupons → score → rank.
 */
export function compareProductPrices(
  productId: string,
  userLat?: number,
  userLng?: number,
  userRadius: number = 25,
): ComparisonResult | { error: { code: string; message: string } } {
  const startTime = Date.now();

  // Check cache
  const cacheKey = `${productId}:${userLat}:${userLng}:${userRadius}`;
  const cached = comparisonCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    logger.debug('price.cache_hit', 'Comparison cache hit', { product_id: productId });
    return cached.result;
  }

  const product = products.get(productId);
  if (!product) {
    return { error: { code: 'NOT_FOUND', message: 'Product not found' } };
  }

  let excludedExpired = 0;

  // Filter out expired prices and build scoring input
  const scoringInputs: ListingInput[] = [];
  const listingMeta: Map<string, { freshness: PriceFreshness; couponCode: string | null; couponDiscount: number }> = new Map();

  for (const sl of product.store_listings) {
    if (!shouldIncludeInResults(sl.last_scraped)) {
      excludedExpired++;
      continue;
    }

    // Find and apply best coupon
    const applicable = findApplicableCoupons(productId, product.category, sl.store_id);
    const { discount, coupon } = bestCouponDiscount(sl.price, applicable);

    const hoursSinceScrape = (Date.now() - sl.last_scraped.getTime()) / (1000 * 60 * 60);

    scoringInputs.push({
      store_id: sl.store_id,
      store_name: sl.store_name,
      base_price: sl.price,
      distance_miles: sl.distance_miles,
      hours_since_scrape: hoursSinceScrape,
      store_rating: sl.store_rating,
      coupon_discount_absolute: coupon?.discount_type === 'absolute' ? discount : 0,
      coupon_discount_percent: coupon?.discount_type === 'percent' ? coupon.discount_value : 0,
      has_coupon: coupon !== null,
    });

    listingMeta.set(sl.store_id, {
      freshness: classifyFreshness(sl.last_scraped),
      couponCode: coupon?.code || null,
      couponDiscount: discount,
    });
  }

  // Score and rank
  const scored = scoreListings(scoringInputs, userRadius);

  // Build result
  const listings = scored.map(s => {
    const meta = listingMeta.get(s.store_id)!;
    return {
      store_id: s.store_id,
      store_name: s.store_name,
      price: s.base_price,
      effective_price: s.effective_price,
      original_price: product.store_listings.find(sl => sl.store_id === s.store_id)?.original_price || s.base_price,
      on_sale: product.store_listings.find(sl => sl.store_id === s.store_id)?.on_sale || false,
      coupon_applied: s.has_coupon,
      coupon_code: meta.couponCode,
      coupon_discount: meta.couponDiscount,
      distance_miles: s.distance_miles,
      store_rating: s.store_rating,
      freshness: meta.freshness,
      deal_score: s.deal_score,
    };
  });

  // Best deal summary
  const best = listings.length > 0 ? listings[0] : null;
  const highest = listings.length > 0 ? Math.max(...listings.map(l => l.effective_price)) : 0;

  const result: ComparisonResult = {
    product_id: productId,
    product_name: product.canonical_name,
    category: product.category,
    brand: product.brand,
    listings,
    best_deal: best ? {
      store_name: best.store_name,
      effective_price: best.effective_price,
      deal_score: best.deal_score,
      savings_vs_highest: Math.round((highest - best.effective_price) * 100) / 100,
    } : null,
    comparison_metadata: {
      total_listings: product.store_listings.length,
      excluded_expired: excludedExpired,
      response_time_ms: Date.now() - startTime,
    },
  };

  // Cache result
  comparisonCache.set(cacheKey, { result, expires: Date.now() + CACHE_TTL_MS });

  logger.info('price.compare', 'Price comparison completed', {
    product_id: productId,
    listings_count: listings.length,
    excluded_expired: excludedExpired,
    response_time_ms: result.comparison_metadata.response_time_ms,
  });

  return result;
}

/**
 * Get best deals across all products in a category.
 * Returns top N products by best deal score.
 */
export function getBestDeals(
  category?: string,
  userLat?: number,
  userLng?: number,
  userRadius: number = 25,
  limit: number = 20,
): { product_id: string; product_name: string; best_price: number; best_store: string; deal_score: number; category: string }[] {
  const deals: { product_id: string; product_name: string; best_price: number; best_store: string; deal_score: number; category: string }[] = [];

  for (const product of products.values()) {
    if (category && product.category.toLowerCase() !== category.toLowerCase()) continue;

    const comparison = compareProductPrices(product.product_id, userLat, userLng, userRadius);
    if ('error' in comparison) continue;
    if (!comparison.best_deal) continue;

    deals.push({
      product_id: product.product_id,
      product_name: product.canonical_name,
      best_price: comparison.best_deal.effective_price,
      best_store: comparison.best_deal.store_name,
      deal_score: comparison.best_deal.deal_score,
      category: product.category,
    });
  }

  return deals.sort((a, b) => b.deal_score - a.deal_score).slice(0, limit);
}

// Price history tracking
const priceHistory = new Map<string, { price: number; timestamp: Date }[]>();

/**
 * Record a price observation for history tracking.
 */
export function recordPrice(storeProductId: string, price: number): void {
  const history = priceHistory.get(storeProductId) || [];
  history.push({ price, timestamp: new Date() });
  // Keep last 100 entries per product-store pair
  if (history.length > 100) history.shift();
  priceHistory.set(storeProductId, history);
}

/**
 * Get price history for trending analysis.
 */
export function getPriceHistory(storeProductId: string): { price: number; timestamp: Date }[] {
  return priceHistory.get(storeProductId) || [];
}

/** Index a product for comparison */
export function indexProduct(product: ProductForComparison): void {
  products.set(product.product_id, product);
}

/** Invalidate cache for a product (on price change) */
export function invalidateCache(productId: string): void {
  for (const key of comparisonCache.keys()) {
    if (key.startsWith(productId + ':')) {
      comparisonCache.delete(key);
    }
  }
}

/** Clear all (testing) */
export function _resetAll(): void {
  products.clear();
  comparisonCache.clear();
  priceHistory.clear();
}
