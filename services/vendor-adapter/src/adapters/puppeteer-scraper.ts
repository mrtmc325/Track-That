// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Puppeteer Stealth Scraper — maximum anti-detection evasion.
 *
 * Forges:
 * 1. TLS fingerprint — Chromium flags to match real Chrome TLS behavior
 * 2. Canvas/WebGL fingerprint — injects noise into canvas/WebGL APIs
 * 3. Mouse movement — simulates human-like mouse paths and scrolling
 * 4. All standard stealth: WebDriver, chrome runtime, permissions, plugins
 */
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer-core';
import type { VendorAdapter, AdapterResult, RawProduct, AdapterType } from './adapter.interface.js';
import type { StoreScraperConfig } from './store-configs.js';
import { waitForRateLimit } from '../utils/rate-limiter.js';
import { logger } from '../utils/logger.js';
import { getPuppeteerProxyArgs, getRandomUserAgent } from '../utils/proxy-client.js';
import { detectCaptcha, getSession } from '../services/captcha.service.js';

puppeteerExtra.use(StealthPlugin());

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const PAGE_TIMEOUT = 120000;   // 2 minutes — user may need to solve CAPTCHA
const SELECTOR_TIMEOUT = 30000; // 30s after CAPTCHA solved
const CAPTCHA_WAIT_MS = 120000; // 2 minutes max wait for user to solve
const MAX_PRODUCTS = 50;

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.connected) return browserInstance;

  browserInstance = await puppeteerExtra.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--single-process',            // Required for Docker containers
      '--no-zygote',                  // Fix dbus crash in containers
      '--disable-software-rasterizer',
      '--disable-background-networking',
      '--disable-default-apps',

      // ─── TLS FINGERPRINT SPOOFING ───
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--lang=en-US,en',
      '--window-size=1920,1080',

      ...getPuppeteerProxyArgs(),
    ],
    timeout: PAGE_TIMEOUT,
    ignoreDefaultArgs: ['--enable-automation'], // Remove the automation flag entirely
  }) as Browser;

  logger.info('puppeteer.stealth_launched', 'Stealth Chromium launched with fingerprint spoofing', {
    pid: browserInstance.process()?.pid,
  });

  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance && browserInstance.connected) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Inject Canvas/WebGL fingerprint noise.
 * Adds subtle random perturbations to canvas/WebGL output so each session
 * has a unique but realistic fingerprint. Prevents cross-session tracking.
 */
async function injectFingerprintNoise(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(function() {
    // ─── CANVAS FINGERPRINT NOISE ───
    // Intercept toDataURL and getImageData to add subtle noise
    var origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type) {
      var ctx = this.getContext('2d');
      if (ctx) {
        // Add invisible noise pixel to alter fingerprint hash
        var imageData = ctx.getImageData(0, 0, 1, 1);
        imageData.data[0] = imageData.data[0] ^ (Math.random() * 2 | 0);
        ctx.putImageData(imageData, 0, 0);
      }
      return origToDataURL.apply(this, arguments as any);
    };

    // ─── WEBGL FINGERPRINT NOISE ───
    var origGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(param) {
      // Spoof renderer and vendor strings
      if (param === 37445) return 'Google Inc. (NVIDIA)';  // UNMASKED_VENDOR_WEBGL
      if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)'; // UNMASKED_RENDERER_WEBGL
      return origGetParameter.call(this, param);
    };

    // Also handle WebGL2
    if (typeof WebGL2RenderingContext !== 'undefined') {
      var origGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return 'Google Inc. (NVIDIA)';
        if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)';
        return origGetParameter2.call(this, param);
      };
    }

    // ─── NAVIGATOR OVERRIDES ───
    Object.defineProperty(navigator, 'webdriver', { get: function() { return false; } });
    Object.defineProperty(navigator, 'languages', { get: function() { return ['en-US', 'en']; } });
    Object.defineProperty(navigator, 'plugins', { get: function() {
      return [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ];
    }});
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: function() { return 8; } });
    Object.defineProperty(navigator, 'deviceMemory', { get: function() { return 8; } });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: function() { return 0; } });

    // ─── CHROME RUNTIME ───
    (window as any).chrome = {
      runtime: { id: undefined, connect: function() {}, sendMessage: function() {} },
      loadTimes: function() { return {}; },
      csi: function() { return {}; },
    };

    // ─── PERMISSIONS API ───
    var origQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = function(desc) {
      if ((desc as any).name === 'notifications') {
        return Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus);
      }
      return origQuery.call(window.navigator.permissions, desc);
    };

    // ─── SCREEN PROPERTIES ───
    Object.defineProperty(screen, 'colorDepth', { get: function() { return 24; } });
    Object.defineProperty(screen, 'pixelDepth', { get: function() { return 24; } });
  });
}

/**
 * Simulate human-like mouse movements and scrolling.
 * Creates realistic interaction patterns that bot detectors look for.
 */
async function simulateHumanBehavior(page: Page): Promise<void> {
  // Random initial mouse position
  const startX = 200 + Math.random() * 800;
  const startY = 200 + Math.random() * 400;
  await page.mouse.move(startX, startY);

  // Simulate natural mouse movement path (bezier curve approximation)
  const steps = 5 + Math.floor(Math.random() * 5);
  for (let i = 0; i < steps; i++) {
    const x = 100 + Math.random() * 1000;
    const y = 100 + Math.random() * 600;
    await page.mouse.move(x, y, { steps: 8 + Math.floor(Math.random() * 12) });
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
  }

  // Scroll down naturally (variable speed, not uniform)
  const scrolls = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < scrolls; i++) {
    const distance = 200 + Math.floor(Math.random() * 400);
    await page.evaluate(function(d) {
      window.scrollBy({ top: d, behavior: 'smooth' });
    }, distance);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
  }

  // Scroll back up a bit (humans don't just scroll down monotonically)
  await page.evaluate(function() {
    window.scrollBy({ top: -150 - Math.random() * 200, behavior: 'smooth' });
  });
  await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
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
      await waitForRateLimit(storeConfig.domain, 1);

      const browser = await getBrowser();
      page = await browser.newPage() as Page;

      // Randomized viewport
      const viewports = [
        { width: 1366, height: 768 }, { width: 1440, height: 900 },
        { width: 1536, height: 864 }, { width: 1920, height: 1080 },
        { width: 1680, height: 1050 }, { width: 2560, height: 1440 },
      ];
      const vp = viewports[Math.floor(Math.random() * viewports.length)];
      await page.setViewport(vp);

      // Random user agent
      await page.setUserAgent(getRandomUserAgent());

      // Inject all fingerprint forgeries BEFORE navigation
      await injectFingerprintNoise(page);

      // Block heavy resources but keep JS + CSS (some sites check CSS rendering)
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const renderStart = Date.now();
      logger.info('puppeteer.navigating', `Navigating to ${storeConfig.domain} (stealth+fingerprint)`, {
        domain: storeConfig.domain, viewport: `${vp.width}x${vp.height}`,
      });

      // Navigate
      await page.goto(source, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });

      // ─── CAPTCHA DETECTION & RELAY ───
      // Check if the page shows a CAPTCHA challenge.
      // If detected, store session so frontend can relay user clicks to solve it.
      const captchaResult = await detectCaptcha(page, storeConfig.domain, storeConfig.query || '');
      if (captchaResult.detected) {
        logger.notice('puppeteer.captcha_waiting', `CAPTCHA detected on ${storeConfig.domain}. Waiting for user to solve...`, {
          sessionId: captchaResult.sessionId,
          domain: storeConfig.domain,
        });

        // Wait up to 2 minutes for the user to solve the CAPTCHA via the frontend modal
        const solved = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), CAPTCHA_WAIT_MS);
          const check = setInterval(() => {
            const session = getSession(captchaResult.sessionId);
            if (!session || session.solved) {
              clearTimeout(timeout);
              clearInterval(check);
              resolve(true);
            }
          }, 1000);
        });

        if (!solved) {
          logger.warning('puppeteer.captcha_timeout', `CAPTCHA timeout on ${storeConfig.domain}`, { domain: storeConfig.domain });
          return {
            success: false,
            products: [],
            errors: ['CAPTCHA not solved within timeout'],
            extraction_time_ms: Date.now() - startTime,
            source,
            captchaRequired: true,
            captchaSessionId: captchaResult.sessionId,
            captchaScreenshot: captchaResult.screenshot,
          } as any;
        }

        logger.notice('puppeteer.captcha_solved', `CAPTCHA solved on ${storeConfig.domain}. Continuing extraction.`, {
          domain: storeConfig.domain,
        });

        // Wait for page to reload/update after CAPTCHA solve
        await new Promise(r => setTimeout(r, 3000));
      }

      // Simulate human behavior BEFORE extraction (triggers lazy-load, passes behavior checks)
      await simulateHumanBehavior(page);

      // Wait for products
      const selectors = storeConfig.selectors;
      try {
        await page.waitForSelector(selectors.productContainer, { timeout: SELECTOR_TIMEOUT });
      } catch {
        await new Promise(r => setTimeout(r, 3000));
        // Scroll more — some sites lazy-load on scroll
        await page.evaluate(function() { window.scrollTo(0, document.body.scrollHeight / 2); });
        await new Promise(r => setTimeout(r, 2000));
        const hasContent = await page.$(selectors.productContainer);
        if (!hasContent) {
          logger.warning('puppeteer.no_products', `Products not found on ${storeConfig.domain}`, {
            domain: storeConfig.domain, selector: selectors.productContainer, renderTime: Date.now() - renderStart,
          });
          return { success: false, products: [], errors: ['Product container not found'], extraction_time_ms: Date.now() - startTime, source };
        }
      }

      const renderTime = Date.now() - renderStart;

      // Extract using page.evaluate (avoids tsx serialization issues)
      const extractedProducts = await page.evaluate(
        function(containerSel, nameSel, priceSel, origPriceSel, imgSel, brandSel, maxItems) {
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
        },
        selectors.productContainer, selectors.productName, selectors.price,
        selectors.originalPrice || '', selectors.imageUrl || '', selectors.brand || '', MAX_PRODUCTS,
      ) as { raw_name: string; raw_price: string; original_price: string; image_url: string; brand: string }[];

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
        domain: storeConfig.domain, products_found: products.length,
        render_time_ms: renderTime, total_time_ms: Date.now() - startTime,
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
