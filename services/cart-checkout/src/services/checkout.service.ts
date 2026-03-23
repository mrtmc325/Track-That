// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Checkout Service — orchestrates the checkout flow.
 * Per Phase 7 spec: initiate → fulfillment → pay → complete.
 *
 * security.secrets_managed_not_stored — Stripe secrets from env only
 * security.no_sensitive_data_in_logs — no card data ever logged
 * reliability.idempotent_and_retry_safe_interfaces — checkout steps are idempotent
 */
import crypto from 'node:crypto';
import * as cartService from './cart.service.js';
import { logger } from '../utils/logger.js';

export interface CheckoutSummary {
  cart_id: string;
  store_groups: {
    store_id: string;
    store_name: string;
    items: { product_name: string; quantity: number; unit_price: number }[];
    subtotal: number;
    fulfillment: string | null;
    delivery_fee: number;
  }[];
  total: number;
  price_locked_until: string;
}

export interface PaymentResult {
  /** In production: Stripe PaymentIntent client_secret */
  client_secret: string;
  payment_intent_id: string;
  amount_cents: number;
}

export interface Order {
  id: string;
  user_id: string;
  cart_id: string;
  status: 'pending' | 'confirmed' | 'partially_fulfilled' | 'fulfilled' | 'cancelled';
  total_amount: number;
  store_groups: OrderStoreGroup[];
  placed_at: string;
  updated_at: string;
}

export interface OrderStoreGroup {
  id: string;
  order_id: string;
  store_id: string;
  store_name: string;
  fulfillment_method: 'pickup' | 'delivery';
  delivery_tracking_id: string | null;
  delivery_provider: string | null;
  subtotal: number;
  delivery_fee: number;
  items: { product_name: string; quantity: number; unit_price: number }[];
}

// In-memory stores
const orders = new Map<string, Order>();
const payments = new Map<string, { cart_id: string; amount_cents: number; status: string }>();

/**
 * Initiate checkout: validate cart, lock prices, transition to checkout state.
 */
export function initiateCheckout(userId: string): CheckoutSummary | { error: { code: string; message: string } } {
  const cart = cartService.getOrCreateCart(userId);

  if (cart.status === 'empty' || cart.item_count === 0) {
    return { error: { code: 'CART_EMPTY', message: 'Cart is empty' } };
  }

  if (cart.status !== 'active' && cart.status !== 'checkout') {
    return { error: { code: 'INVALID_STATE', message: `Cannot checkout from '${cart.status}' state` } };
  }

  // Transition to checkout (locks prices for 15 minutes)
  // Idempotent: if already in checkout, just refresh the price lock
  if (cart.status !== 'checkout') {
    const result = cartService.transitionCart(cart.id, 'checkout');
    if ('error' in result) {
      return { error: { code: 'TRANSITION_FAILED', message: result.error } };
    }
  } else {
    // Refresh price lock for re-initiation
    (cart as any).price_locked_at = new Date().toISOString();
    (cart as any).updated_at = new Date().toISOString();
  }

  const lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  logger.notice('checkout.initiated', 'Checkout initiated', {
    cart_id: cart.id,
    user_id: userId,
    total: cart.total,
    store_count: cart.store_groups.length,
  });

  return {
    cart_id: cart.id,
    store_groups: cart.store_groups.map(g => ({
      store_id: g.store_id,
      store_name: g.store_name,
      items: g.items.map(i => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
      subtotal: g.subtotal,
      fulfillment: g.fulfillment,
      delivery_fee: g.delivery_fee,
    })),
    total: cart.total,
    price_locked_until: lockExpiry,
  };
}

/**
 * Process payment: create a mock PaymentIntent.
 * In production: calls Stripe PaymentIntents API.
 * Per security.secrets_managed_not_stored — no card data touches our servers.
 */
export function processPayment(cartId: string): PaymentResult | { error: { code: string; message: string } } {
  const cart = cartService.getCart(cartId);
  if (!cart) return { error: { code: 'NOT_FOUND', message: 'Cart not found' } };

  if (cart.status !== 'checkout' && cart.status !== 'payment_pending') {
    return { error: { code: 'INVALID_STATE', message: `Cannot pay from '${cart.status}' state` } };
  }

  // Check price lock validity
  if (!cartService.isPriceLockValid(cart)) {
    // Reset to active so user can re-verify prices
    cartService.transitionCart(cart.id, 'active');
    return { error: { code: 'PRICE_LOCK_EXPIRED', message: 'Price lock expired. Please re-initiate checkout.' } };
  }

  // Check all store groups have fulfillment selected
  const unsetGroups = cart.store_groups.filter(g => g.fulfillment === null);
  if (unsetGroups.length > 0) {
    return { error: { code: 'FULFILLMENT_REQUIRED', message: 'All store groups must have fulfillment type set' } };
  }

  const amountCents = Math.round(cart.total * 100);
  const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;

  // Transition to payment_pending
  cartService.transitionCart(cart.id, 'payment_pending');

  payments.set(paymentIntentId, { cart_id: cartId, amount_cents: amountCents, status: 'pending' });

  logger.notice('checkout.payment_created', 'PaymentIntent created', {
    cart_id: cartId,
    payment_intent_id: paymentIntentId,
    amount_cents: amountCents,
  });

  return {
    client_secret: `${paymentIntentId}_secret_${crypto.randomBytes(16).toString('hex')}`,
    payment_intent_id: paymentIntentId,
    amount_cents: amountCents,
  };
}

/**
 * Complete checkout: create order + sub-orders.
 * Called after payment confirmation from frontend.
 */
export function completeCheckout(cartId: string, paymentIntentId: string): Order | { error: { code: string; message: string } } {
  const cart = cartService.getCart(cartId);
  if (!cart) return { error: { code: 'NOT_FOUND', message: 'Cart not found' } };

  if (cart.status !== 'payment_pending') {
    return { error: { code: 'INVALID_STATE', message: `Cannot complete from '${cart.status}' state` } };
  }

  const payment = payments.get(paymentIntentId);
  if (!payment || payment.cart_id !== cartId) {
    return { error: { code: 'PAYMENT_MISMATCH', message: 'Payment does not match cart' } };
  }

  // Transition to processing then ordered
  cartService.transitionCart(cart.id, 'processing');

  const orderId = crypto.randomUUID();
  const storeGroups: OrderStoreGroup[] = cart.store_groups.map(g => ({
    id: crypto.randomUUID(),
    order_id: orderId,
    store_id: g.store_id,
    store_name: g.store_name,
    fulfillment_method: g.fulfillment as 'pickup' | 'delivery',
    delivery_tracking_id: g.fulfillment === 'delivery' ? `trk_${crypto.randomBytes(8).toString('hex')}` : null,
    delivery_provider: g.fulfillment === 'delivery' ? 'pending_assignment' : null,
    subtotal: g.subtotal,
    delivery_fee: g.delivery_fee,
    items: g.items.map(i => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
  }));

  const order: Order = {
    id: orderId,
    user_id: cart.user_id,
    cart_id: cartId,
    status: 'confirmed',
    total_amount: cart.total,
    store_groups: storeGroups,
    placed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  orders.set(orderId, order);
  payment.status = 'completed';

  // Transition cart to ordered (terminal)
  cartService.transitionCart(cart.id, 'ordered');

  logger.notice('checkout.complete', 'Order placed', {
    order_id: orderId,
    cart_id: cartId,
    user_id: cart.user_id,
    total: cart.total,
    store_groups: storeGroups.length,
  });

  return order;
}

/** Get order by ID */
export function getOrder(orderId: string): Order | null {
  return orders.get(orderId) || null;
}

/** Get orders for a user */
export function getUserOrders(userId: string): Order[] {
  return Array.from(orders.values())
    .filter(o => o.user_id === userId)
    .sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
}

/** Clear all (testing) */
export function _resetAll(): void {
  orders.clear();
  payments.clear();
}
