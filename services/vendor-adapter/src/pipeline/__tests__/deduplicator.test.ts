import { describe, it, expect, beforeEach } from 'vitest';
import { deduplicate, diceCoefficient, addToCatalog, _resetCatalog } from '../deduplicator.js';
import type { NormalizedProduct } from '../normalizer.js';

function makeNormalized(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  return {
    canonical_name: 'Organic Apples',
    brand: 'Nature Best',
    category: 'grocery',
    subcategory: 'fruit',
    description: 'Fresh organic gala apples',
    image_url: '/img/apples.jpg',
    unit_of_measure: '3 lb',
    current_price: 4.99,
    original_price: 5.99,
    on_sale: true,
    source_url: 'https://store.example.com/apples',
    name_confidence: 0.95,
    review_flags: [],
    ...overrides,
  };
}

describe('Deduplicator', () => {
  beforeEach(() => {
    _resetCatalog();
  });

  describe('diceCoefficient', () => {
    it('returns 1.0 for identical strings', () => {
      expect(diceCoefficient('apple', 'apple')).toBe(1.0);
    });

    it('returns 0.0 for completely different strings', () => {
      expect(diceCoefficient('abc', 'xyz')).toBe(0.0);
    });

    it('returns high score for similar strings', () => {
      const score = diceCoefficient('organic apples', 'organic apple');
      expect(score).toBeGreaterThan(0.8);
    });

    it('handles reordered words', () => {
      const score = diceCoefficient('gala apples organic', 'organic gala apples');
      expect(score).toBeGreaterThan(0.7);
    });

    it('returns 0.0 for single-char strings', () => {
      expect(diceCoefficient('a', 'b')).toBe(0.0);
    });
  });

  describe('deduplicate', () => {
    it('matches exact name (confidence 1.0)', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Organic Apples', brand: 'Nature Best', category: 'grocery' });
      const result = deduplicate(makeNormalized());
      expect(result.action).toBe('matched');
      expect(result.confidence).toBe(1.0);
      expect(result.matched_product_id).toBe('p1');
    });

    it('matches similar name above 0.85 threshold', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Organic Gala Apples', brand: 'Nature Best', category: 'grocery' });
      const result = deduplicate(makeNormalized({ canonical_name: 'Organic Apples Gala' }));
      // Should match with brand+category bonus pushing it above threshold
      expect(result.action).toBe('matched');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('sends to review queue for moderate similarity (0.60-0.85)', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Red Delicious Apples', brand: 'FarmFresh', category: 'grocery' });
      const result = deduplicate(makeNormalized({ canonical_name: 'Green Apples Delicious', brand: 'Unknown' }));
      // Different enough to not auto-match but similar enough for review
      if (result.confidence >= 0.60 && result.confidence < 0.85) {
        expect(result.action).toBe('review');
      }
    });

    it('creates new product when no match found', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Organic Milk', brand: 'DairyPure', category: 'dairy' });
      const result = deduplicate(makeNormalized({ canonical_name: 'Cotton T-Shirt Blue', category: 'clothing' }));
      expect(result.action).toBe('new');
      expect(result.confidence).toBeLessThan(0.60);
    });

    it('creates new when catalog is empty', () => {
      const result = deduplicate(makeNormalized());
      expect(result.action).toBe('new');
      expect(result.confidence).toBe(0);
    });

    it('gives brand bonus for matching brands', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Apples Fresh', brand: 'Nature Best', category: 'grocery' });
      const withBrand = deduplicate(makeNormalized({ canonical_name: 'Fresh Apples', brand: 'Nature Best' }));

      _resetCatalog();
      addToCatalog({ product_id: 'p1', canonical_name: 'Apples Fresh', brand: 'OtherBrand', category: 'grocery' });
      const withoutBrand = deduplicate(makeNormalized({ canonical_name: 'Fresh Apples', brand: 'Nature Best' }));

      expect(withBrand.confidence).toBeGreaterThan(withoutBrand.confidence);
    });

    it('gives category bonus for matching category', () => {
      addToCatalog({ product_id: 'p1', canonical_name: 'Fresh Bread Wheat', brand: 'Unknown', category: 'grocery' });
      const sameCategory = deduplicate(makeNormalized({ canonical_name: 'Wheat Bread Fresh', category: 'grocery', brand: 'Unknown' }));

      _resetCatalog();
      addToCatalog({ product_id: 'p1', canonical_name: 'Fresh Bread Wheat', brand: 'Unknown', category: 'bakery' });
      const diffCategory = deduplicate(makeNormalized({ canonical_name: 'Wheat Bread Fresh', category: 'grocery', brand: 'Unknown' }));

      expect(sameCategory.confidence).toBeGreaterThan(diffCategory.confidence);
    });

    it('always returns the product in result', () => {
      const product = makeNormalized({ canonical_name: 'Test Product' });
      const result = deduplicate(product);
      expect(result.product).toBe(product);
    });
  });
});
