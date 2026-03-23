// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, beforeEach } from 'vitest';
import * as cartService from '../cart.service.js';
import * as checkoutService from '../checkout.service.js';

const USER_ID = 'user-checkout';

function seedCart(): void {
  cartService.addItem(USER_ID, {
    store_id: 'store-1', store_name: 'FreshMart',
    product_id: 'prod-apples', product_name: 'Organic Apples',
    quantity: 2, unit_price: 4.99,
  });
  cartService.addItem(USER_ID, {
    store_id: 'store-2', store_name: 'ValueGrocery',
    product_id: 'prod-bread', product_name: 'Whole Wheat Bread',
    quantity: 1, unit_price: 3.49,
  });
}

describe('Checkout Service', () => {
  beforeEach(() => {
    cartService._resetCarts();
    checkoutService._resetAll();
  });

  describe('initiateCheckout', () => {
    it('creates checkout summary with store groups', () => {
      seedCart();
      const result = checkoutService.initiateCheckout(USER_ID);
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.store_groups).toHaveLength(2);
        expect(result.total).toBeCloseTo(4.99 * 2 + 3.49, 2);
        expect(result.price_locked_until).toBeDefined();
      }
    });

    it('transitions cart to checkout state', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      expect(cart.status).toBe('checkout');
    });

    it('rejects checkout for empty cart', () => {
      const result = checkoutService.initiateCheckout(USER_ID);
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error.code).toBe('CART_EMPTY');
    });

    it('is idempotent (can re-initiate from checkout state)', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const result = checkoutService.initiateCheckout(USER_ID);
      // Should succeed since already in checkout
      expect('error' in result).toBe(false);
    });
  });

  describe('processPayment', () => {
    it('creates payment intent with correct amount', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      // Set fulfillment for all groups
      cartService.setFulfillment(cart.id, 'store-1', 'pickup');
      cartService.setFulfillment(cart.id, 'store-2', 'delivery', 3.99);

      const result = checkoutService.processPayment(cart.id);
      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.client_secret).toContain('_secret_');
        expect(result.payment_intent_id).toMatch(/^pi_/);
        // Total: 4.99*2 + 3.49 + 3.99 delivery = 17.46
        expect(result.amount_cents).toBe(Math.round(17.46 * 100));
      }
    });

    it('transitions cart to payment_pending', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      cartService.setFulfillment(cart.id, 'store-1', 'pickup');
      cartService.setFulfillment(cart.id, 'store-2', 'pickup');
      checkoutService.processPayment(cart.id);
      expect(cartService.getOrCreateCart(USER_ID).status).toBe('payment_pending');
    });

    it('rejects payment without fulfillment set', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      const result = checkoutService.processPayment(cart.id);
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error.code).toBe('FULFILLMENT_REQUIRED');
    });

    it('rejects payment from active state', () => {
      seedCart();
      const cart = cartService.getOrCreateCart(USER_ID);
      const result = checkoutService.processPayment(cart.id);
      expect('error' in result).toBe(true);
    });
  });

  describe('completeCheckout', () => {
    function runFullCheckout(): { cartId: string; paymentIntentId: string } {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      cartService.setFulfillment(cart.id, 'store-1', 'pickup');
      cartService.setFulfillment(cart.id, 'store-2', 'delivery', 3.99);
      const payment = checkoutService.processPayment(cart.id);
      if ('error' in payment) throw new Error('Payment failed');
      return { cartId: cart.id, paymentIntentId: payment.payment_intent_id };
    }

    it('creates order with sub-groups', () => {
      const { cartId, paymentIntentId } = runFullCheckout();
      const order = checkoutService.completeCheckout(cartId, paymentIntentId);
      expect('error' in order).toBe(false);
      if (!('error' in order)) {
        expect(order.id).toBeDefined();
        expect(order.status).toBe('confirmed');
        expect(order.store_groups).toHaveLength(2);
        expect(order.total_amount).toBeCloseTo(17.46, 2);
      }
    });

    it('creates delivery tracking for delivery groups', () => {
      const { cartId, paymentIntentId } = runFullCheckout();
      const order = checkoutService.completeCheckout(cartId, paymentIntentId);
      if (!('error' in order)) {
        const deliveryGroup = order.store_groups.find(g => g.fulfillment_method === 'delivery');
        expect(deliveryGroup?.delivery_tracking_id).toMatch(/^trk_/);
        const pickupGroup = order.store_groups.find(g => g.fulfillment_method === 'pickup');
        expect(pickupGroup?.delivery_tracking_id).toBeNull();
      }
    });

    it('transitions cart to ordered (terminal)', () => {
      const { cartId, paymentIntentId } = runFullCheckout();
      checkoutService.completeCheckout(cartId, paymentIntentId);
      const cart = cartService.getCart(cartId);
      expect(cart?.status).toBe('ordered');
    });

    it('rejects completion with wrong payment intent', () => {
      const { cartId } = runFullCheckout();
      const result = checkoutService.completeCheckout(cartId, 'pi_wrong');
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error.code).toBe('PAYMENT_MISMATCH');
    });

    it('rejects completion from active state', () => {
      seedCart();
      const cart = cartService.getOrCreateCart(USER_ID);
      const result = checkoutService.completeCheckout(cart.id, 'pi_fake');
      expect('error' in result).toBe(true);
    });
  });

  describe('Order History', () => {
    it('retrieves orders for a user', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      cartService.setFulfillment(cart.id, 'store-1', 'pickup');
      cartService.setFulfillment(cart.id, 'store-2', 'pickup');
      const payment = checkoutService.processPayment(cart.id) as any;
      checkoutService.completeCheckout(cart.id, payment.payment_intent_id);

      const orders = checkoutService.getUserOrders(USER_ID);
      expect(orders).toHaveLength(1);
      expect(orders[0].user_id).toBe(USER_ID);
    });

    it('returns empty for user with no orders', () => {
      expect(checkoutService.getUserOrders('nobody')).toEqual([]);
    });

    it('retrieves order by ID', () => {
      seedCart();
      checkoutService.initiateCheckout(USER_ID);
      const cart = cartService.getOrCreateCart(USER_ID);
      cartService.setFulfillment(cart.id, 'store-1', 'pickup');
      cartService.setFulfillment(cart.id, 'store-2', 'pickup');
      const payment = checkoutService.processPayment(cart.id) as any;
      const order = checkoutService.completeCheckout(cart.id, payment.payment_intent_id) as any;

      const fetched = checkoutService.getOrder(order.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(order.id);
    });
  });
});
