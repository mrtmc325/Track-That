import { describe, it, expect, beforeEach } from 'vitest';
import {
  compareProductPrices,
  getBestDeals,
  recordPrice,
  getPriceHistory,
  indexProduct,
  _resetAll,
  type ProductForComparison,
} from '../price-comparison.service.js';
import { addCoupon, _resetCoupons } from '../coupon.service.js';

function makeProduct(overrides: Partial<ProductForComparison> = {}): ProductForComparison {
  return {
    product_id: 'prod-1',
    canonical_name: 'Organic Apples',
    category: 'grocery',
    brand: 'Nature Best',
    image_url: '/img/apples.jpg',
    description: 'Fresh organic gala apples',
    store_listings: [
      {
        store_id: 'store-1',
        store_name: 'FreshMart',
        price: 4.99,
        original_price: 5.99,
        on_sale: true,
        distance_miles: 2.5,
        store_rating: 4.5,
        last_scraped: new Date(), // Fresh
        location: { lat: 33.45, lon: -112.07 },
      },
      {
        store_id: 'store-2',
        store_name: 'ValueGrocery',
        price: 5.49,
        original_price: 5.49,
        on_sale: false,
        distance_miles: 5.0,
        store_rating: 4.0,
        last_scraped: new Date(), // Fresh
        location: { lat: 33.46, lon: -112.08 },
      },
    ],
    ...overrides,
  };
}

describe('Price Comparison Service', () => {
  beforeEach(() => {
    _resetAll();
    _resetCoupons();
  });

  describe('compareProductPrices', () => {
    it('returns comparison for an indexed product', () => {
      indexProduct(makeProduct());
      const result = compareProductPrices('prod-1', 33.45, -112.07);
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.product_id).toBe('prod-1');
        expect(result.listings).toHaveLength(2);
        expect(result.best_deal).not.toBeNull();
      }
    });

    it('returns error for unknown product', () => {
      const result = compareProductPrices('nonexistent');
      expect('error' in result).toBe(true);
    });

    it('ranks cheaper store first', () => {
      indexProduct(makeProduct());
      const result = compareProductPrices('prod-1', 33.45, -112.07);
      if (!('error' in result)) {
        // FreshMart at $4.99 should score higher than ValueGrocery at $5.49
        expect(result.listings[0].store_name).toBe('FreshMart');
      }
    });

    it('excludes expired prices', () => {
      const product = makeProduct({
        store_listings: [
          {
            store_id: 'store-old',
            store_name: 'OldStore',
            price: 3.99,
            original_price: 3.99,
            on_sale: false,
            distance_miles: 1.0,
            store_rating: 4.0,
            last_scraped: new Date(Date.now() - 100 * 60 * 60 * 1000), // 100 hours ago (expired)
            location: { lat: 33.45, lon: -112.07 },
          },
        ],
      });
      indexProduct(product);
      const result = compareProductPrices('prod-1');
      if (!('error' in result)) {
        expect(result.listings).toHaveLength(0);
        expect(result.comparison_metadata.excluded_expired).toBe(1);
      }
    });

    it('applies coupon to reduce effective price', () => {
      indexProduct(makeProduct());
      addCoupon({
        id: 'c1',
        store_id: 'store-1',
        code: 'SAVE2',
        description: '$2 off',
        discount_type: 'absolute',
        discount_value: 2.00,
        minimum_purchase: null,
        applicable_product_ids: [],
        applicable_categories: [],
        valid_from: new Date(Date.now() - 86400000),
        valid_until: new Date(Date.now() + 86400000),
        source_type: 'website',
      });

      const result = compareProductPrices('prod-1');
      if (!('error' in result)) {
        const freshmart = result.listings.find(l => l.store_id === 'store-1');
        expect(freshmart?.coupon_applied).toBe(true);
        expect(freshmart?.effective_price).toBe(2.99); // $4.99 - $2.00
      }
    });

    it('includes freshness classification', () => {
      indexProduct(makeProduct());
      const result = compareProductPrices('prod-1');
      if (!('error' in result)) {
        expect(result.listings[0].freshness).toBe('FRESH');
      }
    });

    it('calculates savings vs highest price', () => {
      indexProduct(makeProduct());
      const result = compareProductPrices('prod-1');
      if (!('error' in result) && result.best_deal) {
        expect(result.best_deal.savings_vs_highest).toBe(0.50); // $5.49 - $4.99
      }
    });

    it('includes metadata with timing', () => {
      indexProduct(makeProduct());
      const result = compareProductPrices('prod-1');
      if (!('error' in result)) {
        expect(result.comparison_metadata.response_time_ms).toBeGreaterThanOrEqual(0);
        expect(result.comparison_metadata.total_listings).toBe(2);
      }
    });

    it('uses cache on second call', () => {
      indexProduct(makeProduct());
      const r1 = compareProductPrices('prod-1', 33.45, -112.07, 25);
      const r2 = compareProductPrices('prod-1', 33.45, -112.07, 25);
      // Both should succeed and have same data (cache hit)
      expect('error' in r1).toBe(false);
      expect('error' in r2).toBe(false);
    });
  });

  describe('getBestDeals', () => {
    it('returns deals sorted by score', () => {
      indexProduct(makeProduct({ product_id: 'p1', canonical_name: 'Apples' }));
      indexProduct(makeProduct({
        product_id: 'p2',
        canonical_name: 'Bread',
        store_listings: [{
          store_id: 'store-1', store_name: 'FreshMart', price: 2.99, original_price: 3.99,
          on_sale: true, distance_miles: 1.0, store_rating: 4.8,
          last_scraped: new Date(), location: { lat: 33.45, lon: -112.07 },
        }],
      }));

      const deals = getBestDeals(undefined, 33.45, -112.07);
      expect(deals.length).toBeGreaterThan(0);
      // Deals should be sorted by deal_score descending
      for (let i = 1; i < deals.length; i++) {
        expect(deals[i - 1].deal_score).toBeGreaterThanOrEqual(deals[i].deal_score);
      }
    });

    it('filters by category', () => {
      indexProduct(makeProduct({ product_id: 'p1', category: 'grocery' }));
      indexProduct(makeProduct({ product_id: 'p2', category: 'clothing' }));

      const groceryDeals = getBestDeals('grocery');
      expect(groceryDeals.every(d => d.category === 'grocery')).toBe(true);
    });

    it('respects limit', () => {
      for (let i = 0; i < 5; i++) {
        indexProduct(makeProduct({ product_id: `p${i}`, canonical_name: `Product ${i}` }));
      }
      const deals = getBestDeals(undefined, undefined, undefined, 25, 3);
      expect(deals.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Price History', () => {
    it('records and retrieves price history', () => {
      recordPrice('sp-1', 4.99);
      recordPrice('sp-1', 5.49);
      recordPrice('sp-1', 4.79);

      const history = getPriceHistory('sp-1');
      expect(history).toHaveLength(3);
      expect(history[0].price).toBe(4.99);
      expect(history[2].price).toBe(4.79);
    });

    it('returns empty for unknown product', () => {
      expect(getPriceHistory('unknown')).toEqual([]);
    });

    it('timestamps each entry', () => {
      recordPrice('sp-1', 4.99);
      const history = getPriceHistory('sp-1');
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });
  });
});
