// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findApplicableCoupons,
  bestCouponDiscount,
  addCoupon,
  purgeExpired,
  getStoreCoupons,
  _resetCoupons,
  type Coupon,
} from '../coupon.service.js';

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'cpn-' + Math.random().toString(36).slice(2, 8),
    store_id: 'store-1',
    code: 'SAVE10',
    description: '10% off',
    discount_type: 'percent',
    discount_value: 10,
    minimum_purchase: null,
    applicable_product_ids: [],
    applicable_categories: [],
    valid_from: new Date(Date.now() - 86400000), // yesterday
    valid_until: new Date(Date.now() + 86400000), // tomorrow
    source_type: 'website',
    ...overrides,
  };
}

describe('Coupon Service', () => {
  beforeEach(() => {
    _resetCoupons();
  });

  describe('findApplicableCoupons', () => {
    it('finds coupons for matching store', () => {
      addCoupon(makeCoupon({ id: 'c1', store_id: 'store-1' }));
      const result = findApplicableCoupons('prod-1', 'grocery', 'store-1');
      expect(result).toHaveLength(1);
    });

    it('excludes coupons from different stores', () => {
      addCoupon(makeCoupon({ id: 'c1', store_id: 'store-2' }));
      expect(findApplicableCoupons('prod-1', 'grocery', 'store-1')).toHaveLength(0);
    });

    it('excludes expired coupons', () => {
      addCoupon(makeCoupon({
        id: 'c1',
        valid_from: new Date(Date.now() - 172800000),
        valid_until: new Date(Date.now() - 86400000),
      }));
      expect(findApplicableCoupons('prod-1', 'grocery', 'store-1')).toHaveLength(0);
    });

    it('excludes future coupons', () => {
      addCoupon(makeCoupon({
        id: 'c1',
        valid_from: new Date(Date.now() + 86400000),
        valid_until: new Date(Date.now() + 172800000),
      }));
      expect(findApplicableCoupons('prod-1', 'grocery', 'store-1')).toHaveLength(0);
    });

    it('filters by product ID when specified', () => {
      addCoupon(makeCoupon({ id: 'c1', applicable_product_ids: ['prod-1'] }));
      expect(findApplicableCoupons('prod-1', 'grocery', 'store-1')).toHaveLength(1);
      expect(findApplicableCoupons('prod-2', 'grocery', 'store-1')).toHaveLength(0);
    });

    it('filters by category when specified', () => {
      addCoupon(makeCoupon({ id: 'c1', applicable_categories: ['grocery'] }));
      expect(findApplicableCoupons('prod-1', 'grocery', 'store-1')).toHaveLength(1);
      expect(findApplicableCoupons('prod-1', 'clothing', 'store-1')).toHaveLength(0);
    });

    it('returns universal coupons (no product/category restriction)', () => {
      addCoupon(makeCoupon({ id: 'c1', applicable_product_ids: [], applicable_categories: [] }));
      expect(findApplicableCoupons('any-prod', 'any-cat', 'store-1')).toHaveLength(1);
    });

    it('sorts by discount value descending', () => {
      addCoupon(makeCoupon({ id: 'c1', discount_value: 5 }));
      addCoupon(makeCoupon({ id: 'c2', discount_value: 20 }));
      addCoupon(makeCoupon({ id: 'c3', discount_value: 10 }));
      const result = findApplicableCoupons('prod-1', 'grocery', 'store-1');
      expect(result[0].discount_value).toBe(20);
      expect(result[1].discount_value).toBe(10);
    });
  });

  describe('bestCouponDiscount', () => {
    it('applies percentage discount', () => {
      const coupons = [makeCoupon({ discount_type: 'percent', discount_value: 20 })];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(2.00); // 20% of $10
    });

    it('applies absolute discount', () => {
      const coupons = [makeCoupon({ discount_type: 'absolute', discount_value: 3.00 })];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(3.00);
    });

    it('picks the best coupon among multiple', () => {
      const coupons = [
        makeCoupon({ id: 'c1', discount_type: 'percent', discount_value: 10 }), // $1.00
        makeCoupon({ id: 'c2', discount_type: 'absolute', discount_value: 2.50 }), // $2.50
      ];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(2.50);
      expect(result.coupon?.id).toBe('c2');
    });

    it('respects minimum purchase requirement', () => {
      const coupons = [makeCoupon({ minimum_purchase: 20.00, discount_type: 'absolute', discount_value: 5.00 })];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(0);
      expect(result.coupon).toBeNull();
    });

    it('caps discount at base price', () => {
      const coupons = [makeCoupon({ discount_type: 'absolute', discount_value: 100.00 })];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(10.00);
    });

    it('handles BOGO discount', () => {
      const coupons = [makeCoupon({ discount_type: 'bogo', discount_value: 0 })];
      const result = bestCouponDiscount(10.00, coupons);
      expect(result.discount).toBe(10.00); // Full price off
    });

    it('returns 0 for empty coupon list', () => {
      const result = bestCouponDiscount(10.00, []);
      expect(result.discount).toBe(0);
      expect(result.coupon).toBeNull();
    });
  });

  describe('purgeExpired', () => {
    it('removes expired coupons', () => {
      addCoupon(makeCoupon({ id: 'expired', valid_until: new Date(Date.now() - 86400000) }));
      addCoupon(makeCoupon({ id: 'active' }));
      const count = purgeExpired();
      expect(count).toBe(1);
      expect(getStoreCoupons('store-1')).toHaveLength(1);
    });
  });
});
