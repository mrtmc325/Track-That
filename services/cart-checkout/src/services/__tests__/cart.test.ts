import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateCart,
  addItem,
  updateItemQuantity,
  removeItem,
  transitionCart,
  isPriceLockValid,
  setFulfillment,
  _resetCarts,
} from '../cart.service.js';

const USER_ID = 'user-123';
const ITEM = {
  store_id: 'store-1',
  store_name: 'FreshMart',
  product_id: 'prod-apples',
  product_name: 'Organic Apples',
  quantity: 2,
  unit_price: 4.99,
};

describe('Cart Service', () => {
  beforeEach(() => { _resetCarts(); });

  describe('getOrCreateCart', () => {
    it('creates a new empty cart', () => {
      const cart = getOrCreateCart(USER_ID);
      expect(cart.user_id).toBe(USER_ID);
      expect(cart.status).toBe('empty');
      expect(cart.item_count).toBe(0);
    });

    it('returns same cart on second call', () => {
      const c1 = getOrCreateCart(USER_ID);
      const c2 = getOrCreateCart(USER_ID);
      expect(c1.id).toBe(c2.id);
    });
  });

  describe('addItem', () => {
    it('adds item and transitions to active', () => {
      const cart = addItem(USER_ID, ITEM);
      expect('error' in cart).toBe(false);
      if (!('error' in cart)) {
        expect(cart.status).toBe('active');
        expect(cart.item_count).toBe(2);
        expect(cart.store_groups).toHaveLength(1);
        expect(cart.store_groups[0].store_id).toBe('store-1');
      }
    });

    it('groups items by store', () => {
      addItem(USER_ID, ITEM);
      const cart = addItem(USER_ID, { ...ITEM, store_id: 'store-2', store_name: 'ValueGrocery', product_id: 'prod-bread', product_name: 'Bread', quantity: 1, unit_price: 3.49 });
      if (!('error' in cart)) {
        expect(cart.store_groups).toHaveLength(2);
      }
    });

    it('increments quantity for duplicate product in same store', () => {
      addItem(USER_ID, ITEM);
      const cart = addItem(USER_ID, { ...ITEM, quantity: 3 });
      if (!('error' in cart)) {
        expect(cart.store_groups[0].items[0].quantity).toBe(5); // 2 + 3
      }
    });

    it('calculates totals correctly', () => {
      const cart = addItem(USER_ID, { ...ITEM, quantity: 3, unit_price: 4.99 });
      if (!('error' in cart)) {
        expect(cart.store_groups[0].subtotal).toBeCloseTo(14.97, 2);
        expect(cart.total).toBeCloseTo(14.97, 2);
      }
    });

    it('rejects negative price', () => {
      const result = addItem(USER_ID, { ...ITEM, unit_price: -1 });
      expect('error' in result).toBe(true);
    });

    it('rejects quantity > 99', () => {
      const result = addItem(USER_ID, { ...ITEM, quantity: 100 });
      expect('error' in result).toBe(true);
    });

    it('rejects add during checkout state', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      transitionCart(cart.id, 'checkout');
      const result = addItem(USER_ID, { ...ITEM, product_id: 'prod-new' });
      expect('error' in result).toBe(true);
    });
  });

  describe('updateItemQuantity', () => {
    it('updates quantity', () => {
      const cart = addItem(USER_ID, ITEM) as any;
      const itemId = cart.store_groups[0].items[0].id;
      const result = updateItemQuantity(USER_ID, itemId, 5);
      if (!('error' in result)) {
        expect(result.store_groups[0].items[0].quantity).toBe(5);
      }
    });

    it('removes item when quantity set to 0', () => {
      const cart = addItem(USER_ID, ITEM) as any;
      const itemId = cart.store_groups[0].items[0].id;
      const result = updateItemQuantity(USER_ID, itemId, 0);
      if (!('error' in result)) {
        expect(result.status).toBe('empty');
        expect(result.store_groups).toHaveLength(0);
      }
    });

    it('removes empty store groups', () => {
      addItem(USER_ID, ITEM);
      addItem(USER_ID, { ...ITEM, store_id: 'store-2', store_name: 'Other', product_id: 'p2', product_name: 'Bread', quantity: 1, unit_price: 3.00 });
      const cart = getOrCreateCart(USER_ID);
      const itemId = cart.store_groups[1].items[0].id;
      const result = updateItemQuantity(USER_ID, itemId, 0);
      if (!('error' in result)) {
        expect(result.store_groups).toHaveLength(1);
      }
    });

    it('returns error for nonexistent item', () => {
      addItem(USER_ID, ITEM);
      const result = updateItemQuantity(USER_ID, 'nonexistent', 5);
      expect('error' in result).toBe(true);
    });
  });

  describe('State Machine', () => {
    it('transitions empty → active → checkout', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      const result = transitionCart(cart.id, 'checkout');
      if (!('error' in result)) expect(result.status).toBe('checkout');
    });

    it('sets price_locked_at on checkout', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      transitionCart(cart.id, 'checkout');
      const updated = getOrCreateCart(USER_ID);
      expect(updated.price_locked_at).not.toBeNull();
    });

    it('clears price lock on back to active', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      transitionCart(cart.id, 'checkout');
      transitionCart(cart.id, 'active');
      const updated = getOrCreateCart(USER_ID);
      expect(updated.price_locked_at).toBeNull();
    });

    it('rejects invalid transition (empty → checkout)', () => {
      const cart = getOrCreateCart(USER_ID);
      const result = transitionCart(cart.id, 'checkout');
      expect('error' in result).toBe(true);
    });

    it('rejects invalid transition (active → ordered)', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      const result = transitionCart(cart.id, 'ordered');
      expect('error' in result).toBe(true);
    });
  });

  describe('isPriceLockValid', () => {
    it('returns true when lock is fresh', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      transitionCart(cart.id, 'checkout');
      expect(isPriceLockValid(getOrCreateCart(USER_ID))).toBe(true);
    });

    it('returns false when no lock set', () => {
      addItem(USER_ID, ITEM);
      expect(isPriceLockValid(getOrCreateCart(USER_ID))).toBe(false);
    });
  });

  describe('setFulfillment', () => {
    it('sets fulfillment type for store group', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      const result = setFulfillment(cart.id, 'store-1', 'delivery', 5.99);
      if (!('error' in result)) {
        expect(result.store_groups[0].fulfillment).toBe('delivery');
        expect(result.store_groups[0].delivery_fee).toBe(5.99);
        expect(result.total).toBeCloseTo(4.99 * 2 + 5.99, 2);
      }
    });

    it('sets delivery_fee to 0 for pickup', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      const result = setFulfillment(cart.id, 'store-1', 'pickup');
      if (!('error' in result)) {
        expect(result.store_groups[0].delivery_fee).toBe(0);
      }
    });

    it('returns error for unknown store group', () => {
      addItem(USER_ID, ITEM);
      const cart = getOrCreateCart(USER_ID);
      const result = setFulfillment(cart.id, 'nonexistent', 'pickup');
      expect('error' in result).toBe(true);
    });
  });
});
