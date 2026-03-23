import { describe, it, expect } from 'vitest';
import { calculateEffectivePrice, scoreListings, DEFAULT_WEIGHTS, type ListingInput } from '../scoring.service.js';

describe('Deal Scoring Algorithm', () => {
  describe('calculateEffectivePrice', () => {
    it('applies absolute discount when greater than percentage', () => {
      expect(calculateEffectivePrice(10, 3, 20)).toBe(7); // $3 off > $2 (20%)
    });

    it('applies percentage discount when greater than absolute', () => {
      expect(calculateEffectivePrice(100, 5, 10)).toBe(90); // $10 (10%) > $5
    });

    it('never returns negative price', () => {
      expect(calculateEffectivePrice(5, 10, 0)).toBe(0);
    });

    it('handles zero discounts', () => {
      expect(calculateEffectivePrice(15.99, 0, 0)).toBe(15.99);
    });
  });

  describe('scoreListings', () => {
    const baseListing: ListingInput = {
      store_id: 'store-1',
      store_name: 'Store A',
      base_price: 10,
      distance_miles: 5,
      hours_since_scrape: 2,
      store_rating: 4.5,
      coupon_discount_absolute: 0,
      coupon_discount_percent: 0,
      has_coupon: false,
    };

    it('returns empty array for no listings', () => {
      expect(scoreListings([])).toEqual([]);
    });

    it('ranks cheaper stores higher', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'expensive', base_price: 20 },
        { ...baseListing, store_id: 'cheap', base_price: 5 },
      ];
      const scored = scoreListings(listings);
      expect(scored[0].store_id).toBe('cheap');
    });

    it('ranks closer stores higher when prices are equal', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'far', distance_miles: 20 },
        { ...baseListing, store_id: 'near', distance_miles: 2 },
      ];
      const scored = scoreListings(listings);
      expect(scored[0].store_id).toBe('near');
    });

    it('gives coupon bonus to listings with coupons', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'no-coupon', has_coupon: false },
        { ...baseListing, store_id: 'with-coupon', has_coupon: true, coupon_discount_percent: 10 },
      ];
      const scored = scoreListings(listings);
      expect(scored[0].store_id).toBe('with-coupon');
    });

    it('applies effective price with coupons in scoring', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'full-price', base_price: 10 },
        { ...baseListing, store_id: 'discounted', base_price: 12, coupon_discount_absolute: 5, has_coupon: true },
      ];
      const scored = scoreListings(listings);
      // discounted effective = $7, full = $10 → discounted wins
      expect(scored[0].store_id).toBe('discounted');
      expect(scored[0].effective_price).toBe(7);
    });

    it('penalizes stale data in freshness score', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'fresh', hours_since_scrape: 1 },
        { ...baseListing, store_id: 'stale', hours_since_scrape: 100 },
      ];
      const scored = scoreListings(listings);
      const fresh = scored.find(s => s.store_id === 'fresh')!;
      const stale = scored.find(s => s.store_id === 'stale')!;
      expect(fresh.freshness_score).toBeGreaterThan(stale.freshness_score);
    });

    it('respects custom weights', () => {
      const listings: ListingInput[] = [
        { ...baseListing, store_id: 'cheap-far', base_price: 5, distance_miles: 20 },
        { ...baseListing, store_id: 'pricey-near', base_price: 15, distance_miles: 1 },
      ];
      // Distance-heavy weights
      const distWeights = { ...DEFAULT_WEIGHTS, price: 0.10, distance: 0.60 };
      const scored = scoreListings(listings, 25, distWeights);
      expect(scored[0].store_id).toBe('pricey-near');
    });

    it('normalizes scores to 0-1 range', () => {
      const listings: ListingInput[] = [baseListing];
      const scored = scoreListings(listings);
      expect(scored[0].deal_score).toBeGreaterThanOrEqual(0);
      expect(scored[0].deal_score).toBeLessThanOrEqual(1);
    });
  });
});
