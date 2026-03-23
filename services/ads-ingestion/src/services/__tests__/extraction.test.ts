// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { extractCoupon, extractMultipleCoupons } from '../extraction.service.js';

describe('Extraction Service', () => {
  describe('extractCoupon', () => {
    it('extracts percentage discount', () => {
      const result = extractCoupon('Save 25% off all organic produce!', 'store-1', 'https://store.com', 'website');
      expect(result).not.toBeNull();
      expect(result!.discount_type).toBe('percent');
      expect(result!.discount_value).toBe(25);
    });

    it('extracts dollar discount', () => {
      const result = extractCoupon('Get $5.00 off your next purchase', 'store-1', 'https://store.com', 'flyer');
      expect(result).not.toBeNull();
      expect(result!.discount_type).toBe('absolute');
      expect(result!.discount_value).toBe(5.00);
    });

    it('extracts BOGO offers', () => {
      const result = extractCoupon('Buy one get one free on all cereals', 'store-1', 'https://store.com', 'flyer');
      expect(result).not.toBeNull();
      expect(result!.discount_type).toBe('bogo');
      expect(result!.discount_value).toBe(100);
    });

    it('extracts coupon code', () => {
      const result = extractCoupon('Use code: SAVE20 for 20% off', 'store-1', 'https://store.com', 'website');
      expect(result!.code).toBe('SAVE20');
    });

    it('extracts minimum purchase requirement', () => {
      const result = extractCoupon('$10 off when you spend $50 or more', 'store-1', 'https://store.com', 'flyer');
      expect(result!.minimum_purchase).toBe(50);
    });

    it('extracts expiration date', () => {
      const result = extractCoupon('15% off valid through 12/31/2026', 'store-1', 'https://store.com', 'website');
      expect(result!.valid_until.getFullYear()).toBe(2026);
      expect(result!.valid_until.getMonth()).toBe(11); // December = 11
    });

    it('strips HTML from input', () => {
      const result = extractCoupon('<b>Save 30%</b> off <span>all items</span>', 'store-1', 'https://store.com', 'website');
      expect(result!.description).not.toContain('<b>');
      expect(result!.discount_value).toBe(30);
    });

    it('returns higher confidence for more fields extracted', () => {
      const rich = extractCoupon('Use code SAVE15 for 15% off, minimum $25. Expires 12/31/2026', 'store-1', 'url', 'website');
      const poor = extractCoupon('Some deal available', 'store-1', 'url', 'website');
      expect(rich!.confidence_score).toBeGreaterThan(poor!.confidence_score);
    });

    it('returns null for empty text', () => {
      expect(extractCoupon('', 'store-1', 'url', 'website')).toBeNull();
    });

    it('returns null for very short text', () => {
      expect(extractCoupon('hi', 'store-1', 'url', 'website')).toBeNull();
    });

    it('sets default 7-day validity when no date found', () => {
      const result = extractCoupon('20% off everything', 'store-1', 'url', 'website');
      const now = Date.now();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(result!.valid_until.getTime()).toBeGreaterThan(now + sevenDays - 60000);
    });

    it('preserves store_id and source metadata', () => {
      const result = extractCoupon('10% off', 'store-abc', 'https://store.com/deals', 'rss');
      expect(result!.store_id).toBe('store-abc');
      expect(result!.source_url).toBe('https://store.com/deals');
      expect(result!.source_type).toBe('rss');
    });
  });

  describe('extractMultipleCoupons', () => {
    it('extracts coupons from multi-block text', () => {
      const text = `Save 20% off produce!\n\nGet $5 off bread!\n\nBuy one get one free milk!`;
      const results = extractMultipleCoupons(text, 'store-1', 'url', 'flyer');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('splits on horizontal rules', () => {
      const text = '10% off apples<hr/>$3 off bread---15% off chicken';
      const results = extractMultipleCoupons(text, 'store-1', 'url', 'flyer');
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('filters out blocks with no discount value', () => {
      const text = 'Some random text\n\nSave 20% off everything!';
      const results = extractMultipleCoupons(text, 'store-1', 'url', 'flyer');
      expect(results.every(c => c.discount_value > 0)).toBe(true);
    });
  });
});
