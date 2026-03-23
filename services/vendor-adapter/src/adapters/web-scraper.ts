// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Web Scraper Adapter — fetches product pages and extracts data using Cheerio.
 * Per Phase 4 spec: scraping with robots.txt compliance and rate limiting.
 *
 * security.validate_all_untrusted_input — all scraped data treated as untrusted
 * reliability.timeouts_retries_and_circuit_breakers — 10s fetch timeout
 */
import * as cheerio from 'cheerio';
import type { VendorAdapter, AdapterResult, RawProduct, AdapterType } from './adapter.interface.js';
import type { StoreScraperConfig } from './store-configs.js';
import { isAllowed } from '../utils/robots.js';
import { waitForRateLimit } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';

export class WebScraperAdapter implements VendorAdapter {
  readonly type: AdapterType = 'web_scraper';

  validateConfig(config: Record<string, unknown>): string | true {
    if (!config.searchUrl || typeof config.searchUrl !== 'string') return 'searchUrl required';
    if (!config.selectors || typeof config.selectors !== 'object') return 'selectors config required';
    return true;
  }

  /**
   * Fetch a store's search page and extract products.
   * config must include: searchUrl, selectors, query, userAgent, domain
   */
  async extract(config: Record<string, unknown>): Promise<AdapterResult> {
    const startTime = Date.now();
    const products: RawProduct[] = [];
    const errors: string[] = [];
    const storeConfig = config as unknown as StoreScraperConfig & { query: string; storeName: string; storeLocation: any };
    const source = storeConfig.searchUrl.replace('{query}', encodeURIComponent(storeConfig.query || ''));

    try {
      // 1. robots.txt compliance
      const robotsResult = await isAllowed(source);
      if (!robotsResult.allowed) {
        logger.warning('scraper.robots_blocked', `Scraping blocked by robots.txt: ${storeConfig.domain}`, { domain: storeConfig.domain });
        return { success: false, products: [], errors: ['Blocked by robots.txt'], extraction_time_ms: Date.now() - startTime, source };
      }

      // 2. Rate limiting
      await waitForRateLimit(storeConfig.domain, robotsResult.crawlDelaySeconds);

      // 3. Fetch HTML with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      let html: string;
      try {
        const response = await fetch(source, {
          signal: controller.signal,
          headers: {
            'User-Agent': storeConfig.userAgent || 'TrackThat-Bot/1.0 (+https://trackhat.local/bot)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          errors.push(`HTTP ${response.status}: ${response.statusText}`);
          logger.warning('scraper.http_error', `Fetch failed for ${storeConfig.domain}`, {
            status: response.status,
            domain: storeConfig.domain,
          });
          return { success: false, products: [], errors, extraction_time_ms: Date.now() - startTime, source };
        }

        html = await response.text();
      } catch (fetchErr) {
        clearTimeout(timeout);
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Fetch failed';
        errors.push(msg);
        logger.error('scraper.fetch_error', `Fetch error for ${storeConfig.domain}: ${msg}`, { domain: storeConfig.domain });
        return { success: false, products: [], errors, extraction_time_ms: Date.now() - startTime, source };
      }

      // 4. Parse HTML with Cheerio
      const $ = cheerio.load(html);
      const selectors = storeConfig.selectors;

      $(selectors.productContainer).each((_i, el) => {
        try {
          const $el = $(el);
          const rawName = $el.find(selectors.productName).first().text().trim();
          const rawPrice = $el.find(selectors.price).first().text().trim();

          if (!rawName || !rawPrice) return; // Skip incomplete entries

          const product: RawProduct = {
            raw_name: rawName,
            raw_price: rawPrice,
            original_price: selectors.originalPrice ? $el.find(selectors.originalPrice).first().text().trim() || undefined : undefined,
            on_sale: selectors.onSale ? !!$el.find(selectors.onSale).length : undefined,
            source_url: source,
            brand: selectors.brand ? $el.find(selectors.brand).first().text().trim() || undefined : undefined,
            image_url: selectors.imageUrl ? $el.find(selectors.imageUrl).first().attr('src') || undefined : undefined,
            description: undefined,
            category: storeConfig.storeType === 'grocery' ? 'grocery' : storeConfig.storeType,
          };

          products.push(product);
        } catch (parseErr) {
          errors.push(`Parse error on product: ${(parseErr as Error).message}`);
        }
      });

      logger.info('scraper.extract', `Extracted ${products.length} products from ${storeConfig.domain}`, {
        domain: storeConfig.domain,
        products_found: products.length,
        errors_count: errors.length,
        extraction_time_ms: Date.now() - startTime,
      });

      return {
        success: products.length > 0,
        products,
        errors,
        extraction_time_ms: Date.now() - startTime,
        source,
      };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('scraper.extract_error', `Scraper error for ${storeConfig.domain}: ${msg}`, { domain: storeConfig.domain });
      return { success: false, products: [], errors: [msg], extraction_time_ms: Date.now() - startTime, source };
    }
  }
}
