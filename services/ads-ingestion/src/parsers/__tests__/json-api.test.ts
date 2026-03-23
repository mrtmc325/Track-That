// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseJsonCoupon, parseJsonCoupons } from '../json-api.parser.js';

describe('JSON API Parser', () => {
  it('parses a percentage coupon', () => {
    const result = parseJsonCoupon({
      store_id: 'store-1',
      description: '15% off produce',
      discount_type: 'percent',
      discount_percent: 15,
      code: 'fresh15',
      valid_until: '2026-12-31',
    }, 'https://api.example.com');
    expect(result).not.toBeNull();
    expect(result!.discount_type).toBe('percent');
    expect(result!.discount_value).toBe(15);
    expect(result!.code).toBe('FRESH15');
    expect(result!.confidence_score).toBe(0.9);
  });

  it('parses an absolute discount', () => {
    const result = parseJsonCoupon({
      store_id: 'store-1',
      description: '$5 off order',
      discount_amount: 5,
    }, 'url');
    expect(result!.discount_type).toBe('absolute');
    expect(result!.discount_value).toBe(5);
  });

  it('parses BOGO', () => {
    const result = parseJsonCoupon({
      store_id: 'store-1',
      description: 'Buy one get one free',
      discount_type: 'bogo',
    }, 'url');
    expect(result!.discount_type).toBe('bogo');
    expect(result!.discount_value).toBe(100);
  });

  it('returns null for missing description', () => {
    expect(parseJsonCoupon({ store_id: 's', description: '' }, 'url')).toBeNull();
  });

  it('defaults to 30-day validity', () => {
    const result = parseJsonCoupon({ store_id: 's', description: 'Some deal' }, 'url');
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(result!.valid_until.getTime()).toBeGreaterThan(Date.now() + thirtyDays - 60000);
  });

  it('parses batch of coupons', () => {
    const results = parseJsonCoupons([
      { store_id: 's1', description: '10% off', discount_percent: 10 },
      { store_id: 's2', description: '$3 off', discount_amount: 3 },
      { store_id: 's3', description: '' }, // Should be filtered
    ], 'url');
    expect(results).toHaveLength(2);
  });

  it('includes product and category filters', () => {
    const result = parseJsonCoupon({
      store_id: 's',
      description: 'Deal on milk',
      discount_amount: 1,
      products: ['prod-milk'],
      categories: ['dairy'],
    }, 'url');
    expect(result!.applicable_products).toEqual(['prod-milk']);
    expect(result!.applicable_categories).toEqual(['dairy']);
  });
});
