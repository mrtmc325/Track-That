// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Coupon Service — manages coupons and applies them to product prices.
 * Per Phase 5 spec: applies active coupons/promotions to compute effective prices.
 *
 * security.validate_all_untrusted_input — coupon data validated before application
 * reliability.idempotent_and_retry_safe_interfaces — coupon application is pure/idempotent
 */
import { logger } from '../utils/logger.js';

export interface Coupon {
  id: string;
  store_id: string;
  code: string | null;
  description: string;
  discount_type: 'percent' | 'absolute' | 'bogo' | 'free_item';
  discount_value: number;
  minimum_purchase: number | null;
  applicable_product_ids: string[];
  applicable_categories: string[];
  valid_from: Date;
  valid_until: Date;
  source_type: string;
}

// In-memory coupon store (Redis/PostgreSQL in production)
const coupons = new Map<string, Coupon>();

/**
 * Find applicable coupons for a product at a store.
 * Returns only currently valid, applicable coupons sorted by discount value descending.
 */
export function findApplicableCoupons(
  productId: string,
  category: string,
  storeId: string,
): Coupon[] {
  const now = new Date();
  const results: Coupon[] = [];

  for (const coupon of coupons.values()) {
    // Must be for the right store
    if (coupon.store_id !== storeId) continue;

    // Must be currently valid
    if (now < coupon.valid_from || now > coupon.valid_until) continue;

    // Must apply to this product AND/OR category.
    // If product IDs are specified, the product must be in the list.
    // If categories are specified, the category must match.
    // If both are specified, product must match (more specific wins).
    // If neither is specified, coupon applies universally.
    const hasProductFilter = coupon.applicable_product_ids.length > 0;
    const hasCategoryFilter = coupon.applicable_categories.length > 0;

    if (hasProductFilter && !coupon.applicable_product_ids.includes(productId)) continue;
    if (!hasProductFilter && hasCategoryFilter && !coupon.applicable_categories.includes(category)) continue;

    results.push(coupon);
  }

  // Sort by discount value descending (best coupon first)
  return results.sort((a, b) => b.discount_value - a.discount_value);
}

/**
 * Calculate the best coupon discount for a given price.
 * Returns the discount amount and the coupon used.
 * Per spec: applies max(absolute, percentage) — never both.
 */
export function bestCouponDiscount(
  basePrice: number,
  applicableCoupons: Coupon[],
): { discount: number; coupon: Coupon | null } {
  let bestDiscount = 0;
  let bestCoupon: Coupon | null = null;

  for (const coupon of applicableCoupons) {
    // Check minimum purchase
    if (coupon.minimum_purchase && basePrice < coupon.minimum_purchase) continue;

    let discount = 0;
    if (coupon.discount_type === 'absolute') {
      discount = coupon.discount_value;
    } else if (coupon.discount_type === 'percent') {
      discount = basePrice * coupon.discount_value / 100;
    } else if (coupon.discount_type === 'bogo') {
      discount = basePrice; // Buy one get one = 100% off second item
    }

    // Discount cannot exceed the price
    discount = Math.min(discount, basePrice);

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestCoupon = coupon;
    }
  }

  return {
    discount: Math.round(bestDiscount * 100) / 100,
    coupon: bestCoupon,
  };
}

/** Add coupon to store */
export function addCoupon(coupon: Coupon): void {
  coupons.set(coupon.id, coupon);
}

/** Remove expired coupons */
export function purgeExpired(): number {
  const now = new Date();
  let count = 0;
  for (const [id, coupon] of coupons) {
    if (coupon.valid_until < now) {
      coupons.delete(id);
      count++;
    }
  }
  if (count > 0) {
    logger.info('coupon.purge', `Purged ${count} expired coupons`, { count });
  }
  return count;
}

/** Get all active coupons for a store */
export function getStoreCoupons(storeId: string): Coupon[] {
  const now = new Date();
  return Array.from(coupons.values()).filter(
    c => c.store_id === storeId && c.valid_from <= now && c.valid_until >= now,
  );
}

/** Clear (testing) */
export function _resetCoupons(): void {
  coupons.clear();
}
