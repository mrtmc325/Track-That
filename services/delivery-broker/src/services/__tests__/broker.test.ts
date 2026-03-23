import { describe, it, expect } from 'vitest';
import { getQuotes, selectProvider, dispatch } from '../broker.service.js';

const BASE_REQUEST = {
  pickup_address: '123 Store St, Phoenix, AZ',
  delivery_address: '456 Home Ave, Phoenix, AZ',
  weight_lbs: 5,
  distance_miles: 3,
  item_category: 'grocery',
};

describe('Broker Service', () => {
  describe('getQuotes', () => {
    it('returns quotes from multiple providers', async () => {
      const quotes = await getQuotes(BASE_REQUEST);
      expect(quotes.length).toBeGreaterThanOrEqual(2); // At least DoorDash + pickup
    });

    it('always includes pickup option', async () => {
      const quotes = await getQuotes(BASE_REQUEST);
      expect(quotes.some(q => q.provider === 'pickup')).toBe(true);
    });

    it('sorts by fee ascending (cheapest first)', async () => {
      const quotes = await getQuotes(BASE_REQUEST);
      for (let i = 1; i < quotes.length; i++) {
        expect(quotes[i - 1].estimated_fee).toBeLessThanOrEqual(quotes[i].estimated_fee);
      }
    });

    it('excludes providers over weight limit', async () => {
      const heavyRequest = { ...BASE_REQUEST, weight_lbs: 35 };
      const quotes = await getQuotes(heavyRequest);
      const deliveryQuotes = quotes.filter(q => q.provider !== 'pickup');
      // Both DoorDash (30lb) and Uber (25lb) should be unavailable
      expect(deliveryQuotes.every(q => !q.available || q.weight_limit_lbs >= 35)).toBe(true);
    });

    it('includes fee and ETA in quotes', async () => {
      const quotes = await getQuotes(BASE_REQUEST);
      const dd = quotes.find(q => q.provider === 'doordash');
      if (dd) {
        expect(dd.estimated_fee).toBeGreaterThan(0);
        expect(dd.estimated_minutes).toBeGreaterThan(0);
      }
    });
  });

  describe('selectProvider', () => {
    it('selects cheapest provider under weight', async () => {
      const quotes = await getQuotes(BASE_REQUEST);
      const selected = selectProvider(quotes, 5);
      expect(selected).not.toBeNull();
      // Pickup is $0, should be cheapest
      expect(selected!.provider).toBe('pickup');
    });

    it('returns null when no provider fits weight', async () => {
      const quotes = [
        { provider: 'doordash' as const, estimated_fee: 5, estimated_minutes: 30, weight_limit_lbs: 30, available: true },
      ];
      const selected = selectProvider(quotes, 50); // Over 30lb limit
      expect(selected).toBeNull();
    });
  });

  describe('dispatch', () => {
    it('dispatches to DoorDash successfully', async () => {
      const result = await dispatch('doordash', {
        order_id: 'order-1',
        pickup_address: '123 Store St',
        delivery_address: '456 Home Ave',
        items: [{ name: 'Apples', quantity: 2 }],
        weight_lbs: 5,
      });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.provider).toBe('doordash');
        expect(result.provider_order_id).toMatch(/^dd_/);
        expect(result.tracking_id).toMatch(/^trk_dd_/);
      }
    });

    it('dispatches to pickup provider', async () => {
      const result = await dispatch('pickup', {
        order_id: 'order-2',
        pickup_address: '123 Store St',
        delivery_address: '',
        items: [{ name: 'Heavy Item', quantity: 1 }],
        weight_lbs: 50,
      });
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.provider).toBe('pickup');
      }
    });

    it('returns error for unknown provider', async () => {
      const result = await dispatch('unknown', {
        order_id: 'o', pickup_address: 'a', delivery_address: 'b', items: [{ name: 'x', quantity: 1 }], weight_lbs: 1,
      });
      expect('error' in result).toBe(true);
    });
  });
});
