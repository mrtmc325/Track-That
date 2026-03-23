// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Crawl Service — orchestrates real-time product crawling across nearby stores.
 *
 * Flow: find stores near user → crawl each for query → normalize → deduplicate → return
 *
 * operability.observability_by_default — logs crawl metrics
 * reliability.timeouts_retries_and_circuit_breakers — per-store timeout, graceful skip on failure
 */
import { WebScraperAdapter } from '../adapters/web-scraper.js';
import { PuppeteerScraperAdapter, closeBrowser } from '../adapters/puppeteer-scraper.js';
import type { VendorAdapter } from '../adapters/adapter.interface.js';
import { findNearbyStoreConfigs, type StoreScraperConfig } from '../adapters/store-configs.js';
import { normalizeProduct, type NormalizedProduct } from '../pipeline/normalizer.js';
import { logger } from '../utils/logger.js';

export interface CrawlRequest {
  query: string;
  lat: number;
  lng: number;
  radius?: number;
}

export interface CrawlResultProduct {
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
    distance_miles: number;
  }[];
}

export interface CrawlResponse {
  products: CrawlResultProduct[];
  stores_crawled: number;
  stores_failed: number;
  total_products_found: number;
  crawl_time_ms: number;
}

// Adapter instances — reused across crawls
const cheerioScraper = new WebScraperAdapter();
const puppeteerScraper = new PuppeteerScraperAdapter();

/**
 * Select the right adapter based on store config.
 * JS-rendered sites (Walmart, Target) use Puppeteer; static sites use Cheerio.
 */
function getAdapter(requiresJs: boolean): VendorAdapter {
  return requiresJs ? puppeteerScraper : cheerioScraper;
}

/**
 * Crawl nearby stores for a product query.
 * Returns normalized, deduplicated products with store listings.
 */
export async function crawlForProducts(request: CrawlRequest): Promise<CrawlResponse> {
  const startTime = Date.now();
  const radius = request.radius || 25;

  // 1. Find stores near the user's location
  const nearbyStores = findNearbyStoreConfigs(request.lat, request.lng, radius);

  if (nearbyStores.length === 0) {
    logger.warning('crawl.no_stores', 'No configured stores found near location', {
      lat: request.lat,
      lng: request.lng,
      radius,
    });
    return { products: [], stores_crawled: 0, stores_failed: 0, total_products_found: 0, crawl_time_ms: Date.now() - startTime };
  }

  logger.info('crawl.start', `Crawling ${nearbyStores.length} stores for "${request.query}"`, {
    query: request.query,
    stores_count: nearbyStores.length,
    radius,
  });

  // 2. Crawl each store in parallel (with per-store timeout)
  let storesCrawled = 0;
  let storesFailed = 0;
  const allNormalized: { product: NormalizedProduct; storeName: string; storeId: string; location: { lat: number; lon: number }; distanceMiles: number; storeRating: number }[] = [];

  const crawlPromises = nearbyStores.map(async ({ config, location, distanceMiles }) => {
    const storeId = `${config.domain}-${location.zip}`;
    try {
      // Select adapter: Puppeteer for JS-rendered sites, Cheerio for static HTML
      const adapter = getAdapter(config.requiresJs);
      logger.debug('crawl.adapter_selected', `Using ${config.requiresJs ? 'Puppeteer' : 'Cheerio'} for ${config.name}`, {
        store: config.name, adapter: config.requiresJs ? 'puppeteer' : 'cheerio',
      });

      const result = await adapter.extract({
        ...config,
        query: request.query,
        storeName: config.name,
        storeLocation: location,
      } as any);

      if (result.success && result.products.length > 0) {
        storesCrawled++;
        for (const rawProduct of result.products) {
          const normalized = normalizeProduct(rawProduct);
          allNormalized.push({
            product: normalized,
            storeName: `${config.name} - ${location.city}`,
            storeId,
            location: { lat: location.lat, lon: location.lng },
            distanceMiles,
            storeRating: 4.0 + Math.random() * 0.8, // Placeholder until review API integration
          });
        }
      } else {
        storesFailed++;
        logger.debug('crawl.store_empty', `No products from ${config.name}`, {
          store: config.name,
          errors: result.errors,
        });
      }
    } catch (err) {
      storesFailed++;
      logger.error('crawl.store_error', `Failed to crawl ${config.name}: ${(err as Error).message}`, {
        store: config.name,
      });
    }
  });

  // Wait for all crawls — 60s overall timeout (users accept longer waits to save money)
  await Promise.race([
    Promise.allSettled(crawlPromises),
    new Promise(resolve => setTimeout(resolve, 60000)),
  ]);

  // Close Puppeteer browser after batch to free memory
  await closeBrowser().catch(() => {});

  // 3. Group normalized products by canonical name → merge store listings
  const productMap = new Map<string, CrawlResultProduct>();

  for (const entry of allNormalized) {
    const key = entry.product.canonical_name.toLowerCase();
    let existing = productMap.get(key);

    if (!existing) {
      existing = {
        product_id: `crawl-${key.replace(/\s+/g, '-').substring(0, 40)}-${Date.now()}`,
        canonical_name: entry.product.canonical_name,
        category: entry.product.category,
        subcategory: entry.product.subcategory || '',
        brand: entry.product.brand,
        description: entry.product.description,
        image_url: entry.product.image_url,
        store_listings: [],
      };
      productMap.set(key, existing);
    }

    existing.store_listings.push({
      store_id: entry.storeId,
      store_name: entry.storeName,
      current_price: entry.product.current_price,
      original_price: entry.product.original_price,
      on_sale: entry.product.on_sale,
      store_rating: Math.round(entry.storeRating * 10) / 10,
      location: entry.location,
      last_updated: new Date().toISOString(),
      distance_miles: entry.distanceMiles,
    });
  }

  const products = Array.from(productMap.values());

  logger.notice('crawl.complete', `Crawl finished: ${products.length} products from ${storesCrawled} stores`, {
    query: request.query,
    products_count: products.length,
    stores_crawled: storesCrawled,
    stores_failed: storesFailed,
    crawl_time_ms: Date.now() - startTime,
  });

  return {
    products,
    stores_crawled: storesCrawled,
    stores_failed: storesFailed,
    total_products_found: allNormalized.length,
    crawl_time_ms: Date.now() - startTime,
  };
}
