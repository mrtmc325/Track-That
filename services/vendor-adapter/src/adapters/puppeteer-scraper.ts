// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Puppeteer Scraper Adapter — for JS-rendered store websites.
 * Uses headless Chromium to execute JavaScript, wait for DOM rendering,
 * then extract product data using the same CSS selectors as Cheerio.
 *
 * Stores like Walmart and Target use React/Next.js — their initial HTML
 * contains no product data. Puppeteer renders the full page first.
 *
 * security.validate_all_untrusted_input — all scraped data treated as untrusted
 * reliability.timeouts_retries_and_circuit_breakers — 15s page timeout, 10s selector wait
 * operability.observability_by_default — logs render time, extraction metrics
 */
import puppeteer from 'puppeteer-core';
import type { VendorAdapter, AdapterResult, RawProduct, AdapterType } from './adapter.interface.js';
import type { StoreScraperConfig } from './store-configs.js';
import { isAllowed } from '../utils/robots.js';
import { waitForRateLimit } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { getPuppeteerProxyArgs, getRandomUserAgent } from '../utils/proxy-client.js';

/** Chromium path — set via PUPPETEER_EXECUTABLE_PATH env var in Docker */
const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

/** Shared browser instance for the crawl batch (avoids cold-start per store) */
let browserInstance: puppeteer.Browser | null = null;

async function getBrowser(): Promise<puppeteer.Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: [
      '--no-sandbox',                // Required for non-root container
      '--disable-setuid-sandbox',    // Required for non-root container
      '--disable-dev-shm-usage',     // Use /tmp instead of /dev/shm (Docker)
      '--disable-gpu',               // No GPU in container
      '--disable-extensions',        // Reduce attack surface
      '--no-first-run',
      '--single-process',            // Reduce memory in container
      '--disable-background-networking',
      '--disable-default-apps',
      ...getPuppeteerProxyArgs(),    // Inject proxy if PROXY_URL is configured
    ],
    timeout: 15000,
  });

  logger.info('puppeteer.browser_launched', 'Headless Chromium launched', {
    pid: browserInstance.process()?.pid,
    executablePath: CHROMIUM_PATH,
  });

  return browserInstance;
}

/**
 * Close the shared browser instance. Call after a crawl batch completes.
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
    logger.debug('puppeteer.browser_closed', 'Headless Chromium closed');
  }
}

export class PuppeteerScraperAdapter implements VendorAdapter {
  readonly type: AdapterType = 'web_scraper';

  validateConfig(config: Record<string, unknown>): string | true {
    if (!config.searchUrl || typeof config.searchUrl !== 'string') return 'searchUrl required';
    if (!config.selectors || typeof config.selectors !== 'object') return 'selectors config required';
    return true;
  }

  async extract(config: Record<string, unknown>): Promise<AdapterResult> {
    const startTime = Date.now();
    const products: RawProduct[] = [];
    const errors: string[] = [];
    const storeConfig = config as unknown as StoreScraperConfig & { query: string };
    const source = storeConfig.searchUrl.replace('{query}', encodeURIComponent(storeConfig.query || ''));

    let page: puppeteer.Page | null = null;

    try {
      // 1. robots.txt compliance
      const robotsResult = await isAllowed(source);
      if (!robotsResult.allowed) {
        logger.warning('puppeteer.robots_blocked', `Blocked by robots.txt: ${storeConfig.domain}`, { domain: storeConfig.domain });
        return { success: false, products: [], errors: ['Blocked by robots.txt'], extraction_time_ms: Date.now() - startTime, source };
      }

      // 2. Rate limiting
      await waitForRateLimit(storeConfig.domain, robotsResult.crawlDelaySeconds);

      // 3. Launch browser + new page
      const browser = await getBrowser();
      page = await browser.newPage();

      // Set viewport and user agent
      await page.setViewport({ width: 1280, height: 800 });
      // Use randomized User-Agent from proxy module (not bot identifier)
      await page.setUserAgent(getRandomUserAgent());

      // Block unnecessary resources to speed up page load
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const renderStart = Date.now();

      // 4. Navigate to search page
      await page.goto(source, {
        waitUntil: 'networkidle2', // Wait until network is quiet
        timeout: 15000,
      });

      // 5. Wait for product container to render
      const selectors = storeConfig.selectors;
      try {
        await page.waitForSelector(selectors.productContainer, { timeout: 10000 });
      } catch {
        // No product container found — page may have loaded differently
        logger.warning('puppeteer.no_products', `Product container not found on ${storeConfig.domain}`, {
          domain: storeConfig.domain,
          selector: selectors.productContainer,
          renderTime: Date.now() - renderStart,
        });
        return { success: false, products: [], errors: ['Product container not found after JS render'], extraction_time_ms: Date.now() - startTime, source };
      }

      const renderTime = Date.now() - renderStart;

      // 6. Extract product data via page.$$eval
      const extractedProducts = await page.$$eval(
        selectors.productContainer,
        (elements, sels) => {
          return elements.slice(0, 50).map((el) => { // Cap at 50 products per page
            const getText = (selector: string) => {
              const node = el.querySelector(selector);
              return node ? node.textContent?.trim() || '' : '';
            };
            const getAttr = (selector: string, attr: string) => {
              const node = el.querySelector(selector);
              return node ? node.getAttribute(attr) || '' : '';
            };

            return {
              raw_name: getText(sels.productName),
              raw_price: getText(sels.price),
              original_price: sels.originalPrice ? getText(sels.originalPrice) : undefined,
              image_url: sels.imageUrl ? getAttr(sels.imageUrl, 'src') : undefined,
              brand: sels.brand ? getText(sels.brand) : undefined,
            };
          });
        },
        {
          productName: selectors.productName,
          price: selectors.price,
          originalPrice: selectors.originalPrice || '',
          imageUrl: selectors.imageUrl || '',
          brand: selectors.brand || '',
        },
      );

      // 7. Convert to RawProduct format
      for (const extracted of extractedProducts) {
        if (!extracted.raw_name || !extracted.raw_price) continue;

        products.push({
          raw_name: extracted.raw_name,
          raw_price: extracted.raw_price,
          original_price: extracted.original_price || undefined,
          on_sale: undefined,
          source_url: source,
          brand: extracted.brand || undefined,
          image_url: extracted.image_url || undefined,
          description: undefined,
          category: storeConfig.storeType === 'grocery' ? 'grocery' : storeConfig.storeType,
        });
      }

      logger.info('puppeteer.extract', `Extracted ${products.length} products from ${storeConfig.domain} (JS render)`, {
        domain: storeConfig.domain,
        products_found: products.length,
        render_time_ms: renderTime,
        total_time_ms: Date.now() - startTime,
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
      logger.error('puppeteer.extract_error', `Puppeteer error for ${storeConfig.domain}: ${msg}`, { domain: storeConfig.domain });
      return { success: false, products: [], errors: [msg], extraction_time_ms: Date.now() - startTime, source };
    } finally {
      // Always close the page (but keep browser alive for next store)
      if (page) {
        try { await page.close(); } catch { /* ignore */ }
      }
    }
  }
}
