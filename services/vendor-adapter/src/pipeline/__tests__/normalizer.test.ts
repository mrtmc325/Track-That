import { describe, it, expect } from 'vitest';
import { normalizeProductName, normalizePrice, normalizeProduct } from '../normalizer.js';
import type { RawProduct } from '../../adapters/adapter.interface.js';

describe('Normalizer', () => {
  describe('normalizeProductName', () => {
    it('strips store-specific prefixes', () => {
      const result = normalizeProductName('Great Value Organic Milk 1 Gallon');
      expect(result.name).not.toContain('Great Value');
      expect(result.brand).toBe('Great Value');
    });

    it('extracts size/weight from name', () => {
      const result = normalizeProductName('Organic Apples 3 lb Bag');
      expect(result.size).toContain('3 lb');
      expect(result.name).not.toContain('3 lb');
    });

    it('extracts oz measurements', () => {
      const result = normalizeProductName('Orange Juice 64 fl oz');
      expect(result.size).toMatch(/64\s*fl\s*oz/i);
    });

    it('title-cases the result', () => {
      const result = normalizeProductName('ORGANIC WHOLE MILK');
      expect(result.name).toBe('Organic Whole Milk');
    });

    it('strips HTML tags', () => {
      const result = normalizeProductName('<b>Chicken Breast</b> Boneless');
      expect(result.name).not.toContain('<b>');
      expect(result.name).toContain('Chicken Breast');
    });

    it('returns low confidence for very short names', () => {
      const result = normalizeProductName('AB');
      expect(result.confidence).toBeLessThan(0.6);
    });

    it('handles empty input', () => {
      const result = normalizeProductName('');
      expect(result.name).toBe('');
    });

    it('cleans up trailing punctuation', () => {
      const result = normalizeProductName('Fresh Salmon Fillet --');
      expect(result.name).not.toMatch(/--$/);
    });
  });

  describe('normalizePrice', () => {
    it('parses simple dollar amount', () => {
      expect(normalizePrice('$4.99').price).toBe(4.99);
    });

    it('parses number without currency symbol', () => {
      expect(normalizePrice('12.50').price).toBe(12.50);
    });

    it('parses numeric input', () => {
      expect(normalizePrice(3.99).price).toBe(3.99);
    });

    it('strips commas from large numbers', () => {
      expect(normalizePrice('$1,234.56').price).toBe(1234.56);
    });

    it('rounds to 2 decimal places', () => {
      expect(normalizePrice(4.999).price).toBe(5.00);
      expect(normalizePrice(4.991).price).toBe(4.99);
    });

    it('flags negative prices', () => {
      const result = normalizePrice(-5.00);
      expect(result.flags).toContain('NEGATIVE_PRICE');
    });

    it('flags zero prices', () => {
      const result = normalizePrice(0);
      expect(result.flags).toContain('ZERO_PRICE');
    });

    it('flags prices over $10,000', () => {
      const result = normalizePrice(15000);
      expect(result.flags).toContain('PRICE_EXCEEDS_10K');
    });

    it('handles unparseable strings', () => {
      const result = normalizePrice('free');
      expect(result.price).toBe(0);
      expect(result.flags).toContain('UNPARSEABLE_PRICE');
    });

    it('handles euro and pound symbols', () => {
      expect(normalizePrice('€12.50').price).toBe(12.50);
      expect(normalizePrice('£8.99').price).toBe(8.99);
    });
  });

  describe('normalizeProduct (full pipeline)', () => {
    const rawProduct: RawProduct = {
      raw_name: 'Great Value Organic Whole Milk 1 Gallon',
      raw_price: '$3.99',
      original_price: '$4.49',
      on_sale: true,
      source_url: 'https://store.example.com/milk',
      brand: undefined,
      category: 'Dairy',
      description: 'Fresh organic whole milk from local farms',
    };

    it('normalizes name and extracts brand from prefix', () => {
      const result = normalizeProduct(rawProduct);
      expect(result.canonical_name).not.toContain('Great Value');
      expect(result.brand).toBe('Great Value');
    });

    it('normalizes prices to decimal', () => {
      const result = normalizeProduct(rawProduct);
      expect(result.current_price).toBe(3.99);
      expect(result.original_price).toBe(4.49);
    });

    it('preserves on_sale flag', () => {
      expect(normalizeProduct(rawProduct).on_sale).toBe(true);
    });

    it('lowercases category', () => {
      expect(normalizeProduct(rawProduct).category).toBe('dairy');
    });

    it('flags anomalous prices', () => {
      const bad: RawProduct = { ...rawProduct, raw_price: -5 };
      expect(normalizeProduct(bad).review_flags).toContain('NEGATIVE_PRICE');
    });

    it('sanitizes description HTML', () => {
      const withHtml: RawProduct = { ...rawProduct, description: '<script>alert(1)</script>Good milk' };
      const result = normalizeProduct(withHtml);
      expect(result.description).not.toContain('<script>');
      expect(result.description).toContain('Good milk');
    });
  });
});
