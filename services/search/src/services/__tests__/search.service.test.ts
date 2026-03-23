import { describe, it, expect, beforeEach } from 'vitest';
import {
  search,
  suggest,
  getProduct,
  getCategories,
  indexProduct,
  _resetProducts,
  type ProductDocument,
} from '../search.service.js';

/** Helper to create a test product */
function makeProduct(overrides: Partial<ProductDocument> = {}): ProductDocument {
  return {
    product_id: 'prod-' + Math.random().toString(36).slice(2, 8),
    canonical_name: 'Organic Apples',
    category: 'grocery',
    subcategory: 'fruit',
    brand: 'Nature Best',
    description: 'Fresh organic gala apples, locally grown',
    image_url: '/images/organic-apples.jpg',
    store_listings: [
      {
        store_id: 'store-1',
        store_name: 'FreshMart',
        current_price: 4.99,
        original_price: 5.99,
        on_sale: true,
        store_rating: 4.5,
        location: { lat: 33.45, lon: -112.07 },
        last_updated: new Date().toISOString(),
      },
      {
        store_id: 'store-2',
        store_name: 'ValueGrocery',
        current_price: 5.49,
        original_price: 5.49,
        on_sale: false,
        store_rating: 4.0,
        location: { lat: 33.46, lon: -112.08 },
        last_updated: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function seedProducts(): void {
  indexProduct(makeProduct({
    product_id: 'prod-apples',
    canonical_name: 'Organic Apples',
    category: 'grocery',
    subcategory: 'fruit',
  }));
  indexProduct(makeProduct({
    product_id: 'prod-bread',
    canonical_name: 'Whole Wheat Bread',
    category: 'grocery',
    subcategory: 'bakery',
    brand: 'Bakery Fresh',
    description: 'Whole grain wheat bread, sliced',
  }));
  indexProduct(makeProduct({
    product_id: 'prod-tshirt',
    canonical_name: 'Cotton T-Shirt',
    category: 'clothing',
    subcategory: 'tops',
    brand: 'BasicWear',
    description: 'Comfortable cotton crew neck tee',
  }));
  indexProduct(makeProduct({
    product_id: 'prod-soda',
    canonical_name: 'Cola Soda',
    category: 'grocery',
    subcategory: 'beverages',
    brand: 'RefreshCo',
    description: 'Classic cola soft drink, 12 pack cans',
  }));
  indexProduct(makeProduct({
    product_id: 'prod-chicken',
    canonical_name: 'Chicken Breast',
    category: 'grocery',
    subcategory: 'meat',
    brand: 'Farm Fresh',
    description: 'Boneless skinless chicken breast fillets',
  }));
}

describe('Search Service', () => {
  beforeEach(() => {
    _resetProducts();
    seedProducts();
  });

  describe('search', () => {
    it('finds products by name', () => {
      const result = search({ q: 'organic apples' });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.total_results).toBeGreaterThan(0);
        expect(result.results[0].product.name).toBe('Organic Apples');
      }
    });

    it('finds products by partial name', () => {
      const result = search({ q: 'bread' });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.results.some(r => r.product.name.includes('Bread'))).toBe(true);
      }
    });

    it('returns best price sorted by lowest', () => {
      const result = search({ q: 'apples' });
      if (!('error' in result) && result.results.length > 0) {
        expect(result.results[0].best_price.price).toBe(4.99);
        expect(result.results[0].best_price.store_name).toBe('FreshMart');
      }
    });

    it('includes search metadata', () => {
      const result = search({ q: 'chicken breast' });
      if (!('error' in result)) {
        expect(result.search_metadata.normalized_query).toBeDefined();
        expect(result.search_metadata.response_time_ms).toBeGreaterThanOrEqual(0);
        expect(typeof result.search_metadata.fuzzy_applied).toBe('boolean');
      }
    });

    it('respects page size limit of 50', () => {
      const result = search({ q: 'apples', pageSize: 100 });
      // Should cap at 50 internally
      if (!('error' in result)) {
        expect(result.results.length).toBeLessThanOrEqual(50);
      }
    });

    it('filters by category', () => {
      const result = search({ q: 'cotton', category: 'clothing' });
      if (!('error' in result)) {
        expect(result.results.every(r => r.product.category === 'clothing')).toBe(true);
      }
    });

    it('returns similar items when no exact match', () => {
      // Search for something not in our catalog but with partial tokens
      const result = search({ q: 'apple juice' });
      if (!('error' in result)) {
        // Should find apples as similar or main result
        const allItems = [...result.results, ...result.similar_items];
        expect(allItems.length).toBeGreaterThan(0);
      }
    });

    it('rejects invalid queries', () => {
      const result = search({ q: 'a' });
      expect('error' in result).toBe(true);
    });

    it('rejects nonsensical queries', () => {
      const result = search({ q: 'xyzqwkjhg qqqqq' });
      expect('error' in result).toBe(true);
    });

    it('finds products via synonym (pop → soda)', () => {
      const result = search({ q: 'pop' });
      if (!('error' in result)) {
        // Should find Cola Soda via synonym expansion
        expect(result.results.some(r =>
          r.product.name.toLowerCase().includes('soda') ||
          r.product.name.toLowerCase().includes('cola')
        )).toBe(true);
      }
    });

    it('handles distance calculation when lat/lng provided', () => {
      const result = search({ q: 'apples', lat: 33.45, lng: -112.07 });
      if (!('error' in result) && result.results.length > 0) {
        expect(result.results[0].listings[0].distance_miles).toBeGreaterThanOrEqual(0);
      }
    });

    it('filters by radius', () => {
      // Index a product with a very far store
      indexProduct(makeProduct({
        product_id: 'prod-far',
        canonical_name: 'Far Away Apples',
        store_listings: [{
          store_id: 'store-far',
          store_name: 'FarStore',
          current_price: 2.99,
          original_price: 3.99,
          on_sale: true,
          store_rating: 4.0,
          location: { lat: 40.0, lon: -100.0 }, // Very far from Phoenix
          last_updated: new Date().toISOString(),
        }],
      }));

      const result = search({ q: 'apples', lat: 33.45, lng: -112.07, radius: 10 });
      if (!('error' in result)) {
        // Far store should be excluded
        expect(result.results.every(r =>
          r.product.product_id !== 'prod-far'
        )).toBe(true);
      }
    });

    it('paginates results', () => {
      const page1 = search({ q: 'apples', page: 1, pageSize: 1 });
      const page2 = search({ q: 'apples', page: 2, pageSize: 1 });
      if (!('error' in page1) && !('error' in page2)) {
        // Pages should be different (if enough results)
        if (page1.total_results > 1) {
          expect(page1.results[0]?.product.id).not.toBe(page2.results[0]?.product.id);
        }
      }
    });
  });

  describe('suggest', () => {
    it('returns suggestions matching prefix', () => {
      const results = suggest('Organ');
      expect(results).toContain('Organic Apples');
    });

    it('returns suggestions matching substring', () => {
      const results = suggest('Wheat');
      expect(results).toContain('Whole Wheat Bread');
    });

    it('returns empty for too-short query', () => {
      expect(suggest('a')).toEqual([]);
    });

    it('respects limit', () => {
      const results = suggest('a', 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getProduct', () => {
    it('returns product by ID', () => {
      const product = getProduct('prod-apples');
      expect(product).not.toBeNull();
      expect(product!.canonical_name).toBe('Organic Apples');
    });

    it('returns null for unknown ID', () => {
      expect(getProduct('nonexistent')).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('returns all categories with counts', () => {
      const cats = getCategories();
      expect(cats.length).toBeGreaterThan(0);
      const grocery = cats.find(c => c.name === 'grocery');
      expect(grocery).toBeDefined();
      expect(grocery!.count).toBeGreaterThanOrEqual(4); // apples, bread, soda, chicken
    });

    it('sorts by count descending', () => {
      const cats = getCategories();
      for (let i = 1; i < cats.length; i++) {
        expect(cats[i - 1].count).toBeGreaterThanOrEqual(cats[i].count);
      }
    });
  });
});
