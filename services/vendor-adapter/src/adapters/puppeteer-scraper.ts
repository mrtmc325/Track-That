// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Puppeteer Stealth Scraper — headless Chromium with anti-detection evasion.
 * Uses puppeteer-extra + stealth plugin to bypass bot detection on major retailers.
 *
 * Timeouts: 30s page load, 15s selector wait — users accept longer waits to save money.
 * No robots.txt checks — this system does not honor robots.txt.
 */
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import type { VendorAdapter, AdapterResult, RawProduct, AdapterType } from './adapter.interface.js';
import type { StoreScraperConfig } from './store-configs.js';
import { waitForRateLimit } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { getPuppeteerProxyArgs, getRandomUserAgent } from '../utils/proxy-client.js';

// Apply stealth plugin — evades headless detection, WebDriver checks, etc.
puppeteerExtra.use(StealthPlugin());

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';

/** Page load timeout — 30s to allow slow JS-heavy sites to fully render */
const PAGE_TIMEOUT = 30000;
/** Selector wait timeout — 15s after page load to find product containers */
const SELECTOR_TIMEOUT = 15000;
/** Max products to extract per page */
const MAX_PRODUCTS = 50;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  browserInstance = await puppeteerExtra.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--no-first-run',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-blink-features=AutomationControlled', // Hide automation flag
      '--window-size=1920,1080',
      ...getPuppeteerProxyArgs(),
    ],
    timeout: PAGE_TIMEOUT,
  }) as Browser;

  logger.info('puppeteer.stealth_launched', 'Stealth Chromium launched', {
    pid: browserInstance.process()?.pid,
  });

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
    logger.debug('puppeteer.browser_closed', 'Chromium closed');
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

    let page: Page | null = null;

    try {
      // Rate limiting (still respectful of server load)
      await waitForRateLimit(storeConfig.domain, 1);

      // Launch stealth browser + new page
      const browser = await getBrowser();
      page = await browser.newPage() as Page;

      // Randomized viewport to look like real users
      const widths = [1366, 1440, 1536, 1920];
      const heights = [768, 900, 864, 1080];
      const idx = Math.floor(Math.random() * widths.length);
      await page.setViewport({ width: widths[idx], height: heights[idx] });

      // Randomized user agent from proxy module
      await page.setUserAgent(getRandomUserAgent());

      // Set realistic browser properties
      await page.evaluateOnNewDocument(() => {
        // Override navigator.webdriver to false
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        // Override chrome runtime
        (window as any).chrome = { runtime: {} };
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) =>
          parameters.name === 'notifications'
            ? Promise.resolve({ state: 'denied' } as PermissionStatus)
            : originalQuery(parameters);
      });

      // Block heavy resources to speed up load (keep JS for rendering)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const renderStart = Date.now();

      // Navigate with 30s timeout
      logger.info('puppeteer.navigating', `Navigating to ${storeConfig.domain}`, {
        domain: storeConfig.domain,
        timeout: PAGE_TIMEOUT,
      });

      await page.goto(source, {
        waitUntil: 'networkidle2',
        timeout: PAGE_TIMEOUT,
      });

      // Wait for product container with 15s timeout
      const selectors = storeConfig.selectors;
      try {
        await page.waitForSelector(selectors.productContainer, { timeout: SELECTOR_TIMEOUT });
      } catch {
        // Try alternative: wait a bit more and check for any content
        await new Promise(r => setTimeout(r, 3000));
        const hasContent = await page.$(selectors.productContainer);
        if (!hasContent) {
          logger.warning('puppeteer.no_products', `Products not found on ${storeConfig.domain}`, {
            domain: storeConfig.domain,
            selector: selectors.productContainer,
            renderTime: Date.now() - renderStart,
          });
          return { success: false, products: [], errors: ['Product container not found'], extraction_time_ms: Date.now() - startTime, source };
        }
      }

      const renderTime = Date.now() - renderStart;

      // Extract products using page.evaluate (avoids tsx serialization issues with $$eval)
      const extractedProducts = await page.evaluate(function(containerSel, nameSel, priceSel, origPriceSel, imgSel, brandSel, maxItems) {
        var cards = document.querySelectorAll(containerSel);
        var results = [];
        for (var i = 0; i < cards.length && i < maxItems; i++) {
          var card = cards[i];
          var nameNode = card.querySelector(nameSel);
          var priceNode = card.querySelector(priceSel);
          var name = nameNode ? nameNode.textContent.trim() : '';
          var price = priceNode ? priceNode.textContent.trim() : '';
          if (!name || !price) continue;
          var origNode = origPriceSel ? card.querySelector(origPriceSel) : null;
          var imgNode = imgSel ? card.querySelector(imgSel) : null;
          var brandNode = brandSel ? card.querySelector(brandSel) : null;
          results.push({
            raw_name: name,
            raw_price: price,
            original_price: origNode ? origNode.textContent.trim() : '',
            image_url: imgNode ? (imgNode.getAttribute('src') || imgNode.getAttribute('data-src') || '') : '',
            brand: brandNode ? brandNode.textContent.trim() : '',
          });
        }
        return results;
      }, selectors.productContainer, selectors.productName, selectors.price,
         selectors.originalPrice || '', selectors.imageUrl || '', selectors.brand || '', MAX_PRODUCTS
      ) as { raw_name: string; raw_price: string; original_price: string; image_url: string; brand: string }[];

      // Convert to RawProduct
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

      logger.notice('puppeteer.extract', `Extracted ${products.length} products from ${storeConfig.domain}`, {
        domain: storeConfig.domain,
        products_found: products.length,
        render_time_ms: renderTime,
        total_time_ms: Date.now() - startTime,
      });

      return { success: products.length > 0, products, errors, extraction_time_ms: Date.now() - startTime, source };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('puppeteer.extract_error', `Error on ${storeConfig.domain}: ${msg}`, { domain: storeConfig.domain });
      return { success: false, products: [], errors: [msg], extraction_time_ms: Date.now() - startTime, source };
    } finally {
      if (page) { try { await page.close(); } catch { /* ignore */ } }
    }
  }
}
