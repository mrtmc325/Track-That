// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Per-store scraper configurations.
 * Each config defines how to find products on a retailer's website.
 *
 * IMPORTANT: Store HTML structures change frequently. These selectors
 * are examples and may need updating. The architecture allows adding
 * new stores via config without code changes.
 *
 * If a store blocks scraping (robots.txt, dynamic rendering, CAPTCHA),
 * the crawl service skips it gracefully and logs a warning.
 */

export interface StoreScraperConfig {
  name: string;
  domain: string;
  storeType: 'grocery' | 'clothing' | 'department' | 'specialty' | 'pharmacy' | 'convenience';
  /** URL template for product search. {query} and {zip} are replaced at runtime. */
  searchUrl: string;
  /** CSS selectors for extracting product data from HTML */
  selectors: {
    productContainer: string;
    productName: string;
    price: string;
    originalPrice?: string;
    imageUrl?: string;
    brand?: string;
    onSale?: string;
  };
  /** Known store locations (lat/lng) for distance calculation. In production: queried from store locator API. */
  locations: { address: string; lat: number; lng: number; city: string; state: string; zip: string }[];
  /** User-Agent to identify our bot per scraping ethics */
  userAgent: string;
  /** Whether this store requires JavaScript rendering (Puppeteer instead of Cheerio) */
  requiresJs: boolean;
}

/**
 * Store configurations.
 * Start with major retailers that have accessible product pages.
 * Add more by appending to this array.
 */
export const STORE_CONFIGS: StoreScraperConfig[] = [
  {
    name: 'Walmart',
    domain: 'www.walmart.com',
    storeType: 'grocery',
    searchUrl: 'https://www.walmart.com/search?q={query}',
    selectors: {
      productContainer: '[data-testid="list-view"] [data-item-id]',
      productName: '[data-automation-id="product-title"], .lh-title span',
      price: '[data-automation-id="product-price"] .f2, .price-main .visuallyhidden',
      originalPrice: '.strike-through, .was-price',
      imageUrl: 'img[data-testid="productTileImage"], img[src*="i5.walmartimages"]',
      brand: '.product-brand, [data-automation-id="product-brand"]',
    },
    locations: [
      { address: '1607 W Bethany Home Rd', lat: 33.5237, lng: -112.0882, city: 'Phoenix', state: 'AZ', zip: '85015' },
      { address: '2501 W Happy Valley Rd', lat: 33.7130, lng: -112.1135, city: 'Phoenix', state: 'AZ', zip: '85085' },
      { address: '1710 E Broadway Blvd', lat: 32.2217, lng: -110.9466, city: 'Tucson', state: 'AZ', zip: '85719' },
      { address: '555 Broadway', lat: 40.7247, lng: -73.9969, city: 'New York', state: 'NY', zip: '10012' },
      { address: '8333 Van Nuys Blvd', lat: 34.2109, lng: -118.4489, city: 'Panorama City', state: 'CA', zip: '91402' },
    ],
    userAgent: 'TrackThat-Bot/1.0 (+https://trackhat.local/bot)',
    requiresJs: true,  // Walmart uses heavy JS rendering
  },
  {
    name: 'Target',
    domain: 'www.target.com',
    storeType: 'department',
    searchUrl: 'https://www.target.com/s?searchTerm={query}',
    selectors: {
      // Updated March 2026 — verified against live Target.com DOM
      productContainer: '[data-test="@web/site-top-of-funnel/ProductCardWrapper"]',
      productName: '[data-test="@web/ProductCard/title"]',
      price: '[data-test="current-price"] span',
      originalPrice: '[data-test="comparison-price"] span',
      imageUrl: 'picture img',
      brand: '[data-test="@web/ProductCard/ProductCardBrandAndRibbonMessage/brand"]',
    },
    locations: [
      { address: '3901 E Thomas Rd', lat: 33.4804, lng: -111.9928, city: 'Phoenix', state: 'AZ', zip: '85018' },
      { address: '4515 E Cactus Rd', lat: 33.5960, lng: -111.9867, city: 'Phoenix', state: 'AZ', zip: '85032' },
      { address: '1201 3rd Ave', lat: 40.7574, lng: -73.9715, city: 'New York', state: 'NY', zip: '10021' },
      { address: '7100 Santa Monica Blvd', lat: 34.0907, lng: -118.3447, city: 'Los Angeles', state: 'CA', zip: '90038' },
    ],
    userAgent: 'TrackThat-Bot/1.0 (+https://trackhat.local/bot)',
    requiresJs: true,
  },
  {
    name: "Fry's Food & Drug",
    domain: 'www.frysfood.com',
    storeType: 'grocery',
    searchUrl: 'https://www.frysfood.com/search?query={query}',
    selectors: {
      productContainer: '.AutoGrid-cell',
      productName: '.kds-Text--l',
      price: '.kds-Price-promotional, .kds-Price',
      originalPrice: '.kds-Price-original',
      imageUrl: '.kds-Image img',
      brand: '.kds-Text--s',
    },
    locations: [
      { address: '3020 E Camelback Rd', lat: 33.5087, lng: -112.0191, city: 'Phoenix', state: 'AZ', zip: '85016' },
      { address: '1125 N 75th St', lat: 33.4488, lng: -111.9245, city: 'Scottsdale', state: 'AZ', zip: '85257' },
    ],
    userAgent: 'TrackThat-Bot/1.0 (+https://trackhat.local/bot)',
    requiresJs: false,  // Kroger sites often have server-rendered content
  },
  {
    name: 'Sprouts Farmers Market',
    domain: 'www.sprouts.com',
    storeType: 'grocery',
    searchUrl: 'https://shop.sprouts.com/search?search_term={query}',
    selectors: {
      productContainer: '.product-card',
      productName: '.product-card__name',
      price: '.product-card__price',
      originalPrice: '.product-card__original-price',
      imageUrl: '.product-card__image img',
    },
    locations: [
      { address: '4502 N 7th St', lat: 33.5049, lng: -112.0622, city: 'Phoenix', state: 'AZ', zip: '85014' },
      { address: '3601 E Indian School Rd', lat: 33.4936, lng: -112.0006, city: 'Phoenix', state: 'AZ', zip: '85018' },
    ],
    userAgent: 'TrackThat-Bot/1.0 (+https://trackhat.local/bot)',
    requiresJs: false,
  },
];

/**
 * Find store configs with locations within radius of given coordinates.
 */
export function findNearbyStoreConfigs(
  lat: number,
  lng: number,
  radiusMiles: number = 25,
): { config: StoreScraperConfig; location: StoreScraperConfig['locations'][0]; distanceMiles: number }[] {
  const results: { config: StoreScraperConfig; location: StoreScraperConfig['locations'][0]; distanceMiles: number }[] = [];

  for (const config of STORE_CONFIGS) {
    for (const loc of config.locations) {
      const distance = haversineDistance(lat, lng, loc.lat, loc.lng);
      if (distance <= radiusMiles) {
        results.push({ config, location: loc, distanceMiles: Math.round(distance * 10) / 10 });
      }
    }
  }

  return results.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

/** Haversine distance in miles */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
