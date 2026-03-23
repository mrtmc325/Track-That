// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Deal scoring algorithm for price comparison ranking.
 * Per scalability.performance_budgets_as_contracts — must complete in < 50ms for 100 listings.
 *
 * Composite score formula:
 *   deal_score = w1 * price_score + w2 * distance_score + w3 * freshness_score
 *                + w4 * store_rating_score + w5 * coupon_bonus
 *
 * Default weights: price=0.45, distance=0.25, freshness=0.10, rating=0.10, coupon=0.10
 */

export interface ScoringWeights {
  price: number;      // default 0.45
  distance: number;   // default 0.25
  freshness: number;  // default 0.10
  rating: number;     // default 0.10
  coupon: number;     // default 0.10
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 0.45,
  distance: 0.25,
  freshness: 0.10,
  rating: 0.10,
  coupon: 0.10,
};

export interface ListingInput {
  store_id: string;
  store_name: string;
  base_price: number;
  distance_miles: number;
  hours_since_scrape: number;
  store_rating: number;       // 0-5
  coupon_discount_absolute: number;
  coupon_discount_percent: number;
  has_coupon: boolean;
}

export interface ScoredListing extends ListingInput {
  effective_price: number;
  deal_score: number;
  price_score: number;
  distance_score: number;
  freshness_score: number;
  rating_score: number;
  coupon_score: number;
}

/**
 * Calculate effective price after applying the best available coupon.
 * Takes the greater discount between absolute and percentage.
 * Per quality.inline_documentation_for_non_obvious_logic:
 *   We apply max(absolute, percentage) not both, to prevent double-discounting.
 */
export function calculateEffectivePrice(
  basePrice: number,
  couponAbsolute: number,
  couponPercent: number,
): number {
  const absoluteDiscount = couponAbsolute;
  const percentDiscount = basePrice * couponPercent / 100;
  const discount = Math.max(absoluteDiscount, percentDiscount);
  return Math.max(0, basePrice - discount); // Never negative
}

/**
 * Score and rank a set of listings for a single product.
 * Returns listings sorted by deal_score descending (best deal first).
 */
export function scoreListings(
  listings: ListingInput[],
  userMaxRadius: number = 25,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): ScoredListing[] {
  if (listings.length === 0) return [];

  // Calculate effective prices first
  const withEffective = listings.map(l => ({
    ...l,
    effective_price: calculateEffectivePrice(l.base_price, l.coupon_discount_absolute, l.coupon_discount_percent),
  }));

  // Find max price for normalization
  const maxPrice = Math.max(...withEffective.map(l => l.effective_price));
  if (maxPrice === 0) {
    // All free — return equal scores
    return withEffective.map(l => ({
      ...l,
      deal_score: 1,
      price_score: 1,
      distance_score: 1 - (l.distance_miles / userMaxRadius),
      freshness_score: Math.max(0, 1 - l.hours_since_scrape / 168),
      rating_score: l.store_rating / 5,
      coupon_score: l.has_coupon ? 1 : 0,
    })).sort((a, b) => b.deal_score - a.deal_score);
  }

  const scored: ScoredListing[] = withEffective.map(l => {
    const price_score = 1 - (l.effective_price / maxPrice);
    const distance_score = Math.max(0, 1 - (l.distance_miles / userMaxRadius));
    const freshness_score = Math.max(0, 1 - (l.hours_since_scrape / 168)); // 7-day window
    const rating_score = l.store_rating / 5;
    const coupon_score = l.has_coupon ? 1 : 0;

    const deal_score =
      weights.price * price_score +
      weights.distance * distance_score +
      weights.freshness * freshness_score +
      weights.rating * rating_score +
      weights.coupon * coupon_score;

    return {
      ...l,
      price_score: Math.round(price_score * 1000) / 1000,
      distance_score: Math.round(distance_score * 1000) / 1000,
      freshness_score: Math.round(freshness_score * 1000) / 1000,
      rating_score: Math.round(rating_score * 1000) / 1000,
      coupon_score,
      deal_score: Math.round(deal_score * 1000) / 1000,
    };
  });

  return scored.sort((a, b) => b.deal_score - a.deal_score);
}
