// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * JSON API Parser — parses structured coupon data from aggregator APIs.
 * Per Phase 9 spec: direct field mapping from JSON response.
 */
import type { CouponExtraction, DiscountType, SourceType } from '../services/extraction.service.js';

export interface JsonCouponInput {
  code?: string;
  description: string;
  discount_type?: string;
  discount_value?: number;
  discount_percent?: number;
  discount_amount?: number;
  minimum_purchase?: number;
  products?: string[];
  categories?: string[];
  valid_from?: string;
  valid_until?: string;
  store_id: string;
}

/**
 * Parse a JSON coupon object into a CouponExtraction.
 * Confidence is high (0.9) since data is structured.
 */
export function parseJsonCoupon(
  input: JsonCouponInput,
  sourceUrl: string,
): CouponExtraction | null {
  if (!input.description || input.description.length < 3) return null;

  let discountType: DiscountType = 'absolute';
  let discountValue = 0;

  if (input.discount_type === 'percent' || input.discount_percent) {
    discountType = 'percent';
    discountValue = input.discount_percent || input.discount_value || 0;
  } else if (input.discount_type === 'bogo') {
    discountType = 'bogo';
    discountValue = 100;
  } else if (input.discount_type === 'free_item') {
    discountType = 'free_item';
    discountValue = 0;
  } else {
    discountValue = input.discount_amount || input.discount_value || 0;
  }

  const validFrom = input.valid_from ? new Date(input.valid_from) : new Date();
  const validUntil = input.valid_until
    ? new Date(input.valid_until)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

  if (isNaN(validFrom.getTime()) || isNaN(validUntil.getTime())) return null;

  return {
    store_id: input.store_id,
    code: input.code?.toUpperCase() || null,
    description: input.description.substring(0, 200),
    discount_type: discountType,
    discount_value: discountValue,
    minimum_purchase: input.minimum_purchase || null,
    applicable_products: input.products || [],
    applicable_categories: input.categories || [],
    valid_from: validFrom,
    valid_until: validUntil,
    source_url: sourceUrl,
    source_type: 'aggregator',
    confidence_score: 0.9, // High confidence for structured data
  };
}

/**
 * Parse an array of JSON coupons.
 */
export function parseJsonCoupons(
  inputs: JsonCouponInput[],
  sourceUrl: string,
): CouponExtraction[] {
  return inputs
    .map(input => parseJsonCoupon(input, sourceUrl))
    .filter((c): c is CouponExtraction => c !== null);
}
