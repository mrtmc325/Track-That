import { describe, it, expect, beforeEach } from 'vitest';
import { findSimilarItems, addToCatalog, _resetCatalog } from '../similar-items.service.js';

describe('Similar Items Service', () => {
  beforeEach(() => {
    _resetCatalog();
    addToCatalog({ product_id: 'p1', canonical_name: 'Organic Gala Apples', category: 'grocery', brand: 'Nature Best' });
    addToCatalog({ product_id: 'p2', canonical_name: 'Red Delicious Apples', category: 'grocery', brand: 'FarmFresh' });
    addToCatalog({ product_id: 'p3', canonical_name: 'Green Granny Smith Apples', category: 'grocery', brand: 'Nature Best' });
    addToCatalog({ product_id: 'p4', canonical_name: 'Organic Bananas', category: 'grocery', brand: 'Nature Best' });
    addToCatalog({ product_id: 'p5', canonical_name: 'Cotton T-Shirt', category: 'clothing', brand: 'BasicWear' });
  });

  it('finds partial name matches with ≥60% term overlap', () => {
    const results = findSimilarItems(['organic', 'apples']);
    const names = results.map(r => r.product_name);
    expect(names).toContain('Organic Gala Apples');
  });

  it('marks match reason as partial_name', () => {
    const results = findSimilarItems(['organic', 'apples']);
    const match = results.find(r => r.product_name === 'Organic Gala Apples');
    expect(match?.match_reason).toBe('partial_name');
  });

  it('finds category matches as fallback', () => {
    const results = findSimilarItems(['xyzqwk'], 'grocery');
    expect(results.some(r => r.match_reason === 'category')).toBe(true);
  });

  it('excludes specified product ID', () => {
    const results = findSimilarItems(['organic', 'apples'], undefined, undefined, 'p1');
    expect(results.find(r => r.product_id === 'p1')).toBeUndefined();
  });

  it('respects limit', () => {
    const results = findSimilarItems(['apples'], 'grocery', undefined, undefined, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('sorts by relevance score descending', () => {
    const results = findSimilarItems(['organic', 'apples']);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].relevance_score).toBeGreaterThanOrEqual(results[i].relevance_score);
    }
  });

  it('returns empty for no matches at all', () => {
    const results = findSimilarItems(['xyzqwk'], 'nonexistent-category');
    expect(results).toHaveLength(0);
  });

  it('returns empty for empty query terms', () => {
    const results = findSimilarItems([]);
    // Category matches still possible if category provided
    expect(results).toHaveLength(0);
  });
});
