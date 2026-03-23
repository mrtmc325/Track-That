import { describe, it, expect, beforeEach } from 'vitest';
import { validateCoupon, validateBatch, getReviewQueue, _resetValidation } from '../validation.service.js';
import type { CouponExtraction } from '../extraction.service.js';

function makeCoupon(overrides: Partial<CouponExtraction> = {}): CouponExtraction {
  return {
    store_id: 'store-1',
    code: 'SAVE10',
    description: '10% off groceries',
    discount_type: 'percent',
    discount_value: 10,
    minimum_purchase: null,
    applicable_products: [],
    applicable_categories: [],
    valid_from: new Date(),
    valid_until: new Date(Date.now() + 7 * 86400000),
    source_url: 'https://store.com',
    source_type: 'website',
    confidence_score: 0.8,
    ...overrides,
  };
}

describe('Validation Service', () => {
  beforeEach(() => { _resetValidation(); });

  it('accepts valid coupon', () => {
    const result = validateCoupon(makeCoupon());
    expect(result.status).toBe('valid');
    expect(result.reasons).toHaveLength(0);
  });

  it('rejects expired coupons', () => {
    const result = validateCoupon(makeCoupon({
      valid_until: new Date(Date.now() - 86400000),
    }));
    expect(result.status).toBe('expired');
  });

  it('detects duplicates', () => {
    validateCoupon(makeCoupon({ code: 'DUP1' }));
    const result = validateCoupon(makeCoupon({ code: 'DUP1' }));
    expect(result.status).toBe('duplicate');
  });

  it('flags suspiciously high percentage (>80%)', () => {
    const result = validateCoupon(makeCoupon({ discount_value: 90 }));
    expect(result.status).toBe('suspicious');
    expect(result.reasons.some(r => r.includes('Suspiciously'))).toBe(true);
  });

  it('flags suspiciously high absolute discount (>$100)', () => {
    const result = validateCoupon(makeCoupon({
      discount_type: 'absolute',
      discount_value: 150,
    }));
    expect(result.status).toBe('suspicious');
  });

  it('sends low confidence (<0.6) to review queue', () => {
    const result = validateCoupon(makeCoupon({ confidence_score: 0.4 }));
    expect(result.status).toBe('needs_review');
    expect(getReviewQueue()).toHaveLength(1);
  });

  it('allows different codes for same store', () => {
    validateCoupon(makeCoupon({ code: 'CODE1' }));
    const result = validateCoupon(makeCoupon({ code: 'CODE2' }));
    expect(result.status).toBe('valid');
  });

  it('allows same code for different stores', () => {
    validateCoupon(makeCoupon({ store_id: 'store-1', code: 'SHARED' }));
    const result = validateCoupon(makeCoupon({ store_id: 'store-2', code: 'SHARED' }));
    expect(result.status).toBe('valid');
  });

  describe('validateBatch', () => {
    it('validates multiple coupons and returns summary', () => {
      const coupons = [
        makeCoupon({ code: 'A' }),
        makeCoupon({ code: 'B' }),
        makeCoupon({ valid_until: new Date(Date.now() - 86400000), code: 'C' }), // Expired
      ];
      const { summary } = validateBatch(coupons);
      expect(summary.valid).toBe(2);
      expect(summary.expired).toBe(1);
    });

    it('detects duplicates within batch', () => {
      const coupons = [
        makeCoupon({ code: 'SAME' }),
        makeCoupon({ code: 'SAME' }),
      ];
      const { summary } = validateBatch(coupons);
      expect(summary.valid).toBe(1);
      expect(summary.duplicate).toBe(1);
    });
  });
});
