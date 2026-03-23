/**
 * Cart Service — split-cart model with per-store grouping.
 * Per Phase 7 spec: single user order may span multiple stores.
 * Each store's items form a sub-group with independent fulfillment.
 *
 * Cart Lifecycle State Machine:
 *   empty → active → checkout → payment_pending → processing → ordered
 *   checkout → active (back to cart)
 *   payment_pending → active (cancel payment)
 *   processing → failed → active (retry)
 *
 * reliability.idempotent_and_retry_safe_interfaces — add/remove are idempotent
 * security.auditability_for_privileged_actions — cart changes logged
 */
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export type CartStatus = 'empty' | 'active' | 'checkout' | 'payment_pending' | 'processing' | 'ordered' | 'failed';
export type FulfillmentType = 'pickup' | 'delivery' | null;

export interface CartItem {
  id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  image_url: string;
  applied_coupon?: { code: string; discount: number };
}

export interface StoreGroup {
  store_id: string;
  store_name: string;
  store_address: string;
  distance_miles: number;
  items: CartItem[];
  fulfillment: FulfillmentType;
  delivery_fee: number;
  subtotal: number;
}

export interface Cart {
  id: string;
  user_id: string;
  status: CartStatus;
  store_groups: StoreGroup[];
  total: number;
  item_count: number;
  /** ISO timestamp when prices were locked (null if not in checkout) */
  price_locked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Valid state transitions per Phase 7 lifecycle spec */
const VALID_TRANSITIONS: Record<CartStatus, CartStatus[]> = {
  empty: ['active'],
  active: ['checkout'],
  checkout: ['payment_pending', 'active'],
  payment_pending: ['processing', 'active'],
  processing: ['ordered', 'failed'],
  ordered: [],      // Terminal
  failed: ['active'], // Retry
};

// In-memory cart store (PostgreSQL in production)
const carts = new Map<string, Cart>();

/** 15-minute price lock window per spec */
const PRICE_LOCK_MS = 15 * 60 * 1000;

/**
 * Get or create a cart for a user.
 * Each user has exactly one active cart.
 */
export function getOrCreateCart(userId: string): Cart {
  // Find existing non-ordered cart
  for (const cart of carts.values()) {
    if (cart.user_id === userId && cart.status !== 'ordered') {
      return cart;
    }
  }

  // Create new cart
  const cart: Cart = {
    id: crypto.randomUUID(),
    user_id: userId,
    status: 'empty',
    store_groups: [],
    total: 0,
    item_count: 0,
    price_locked_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  carts.set(cart.id, cart);
  return cart;
}

/**
 * Add item to cart. Creates store group if needed.
 * Idempotent: adding same product to same store increments quantity.
 */
export function addItem(userId: string, item: {
  store_id: string;
  store_name: string;
  store_address?: string;
  distance_miles?: number;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  image_url?: string;
}): Cart | { error: string } {
  const cart = getOrCreateCart(userId);

  // Can only add items when cart is empty or active
  if (cart.status !== 'empty' && cart.status !== 'active') {
    return { error: `Cannot add items when cart is in '${cart.status}' state` };
  }

  if (item.quantity < 1 || item.quantity > 99) {
    return { error: 'Quantity must be between 1 and 99' };
  }
  if (item.unit_price < 0) {
    return { error: 'Price cannot be negative' };
  }

  // Find or create store group
  let group = cart.store_groups.find(g => g.store_id === item.store_id);
  if (!group) {
    group = {
      store_id: item.store_id,
      store_name: item.store_name,
      store_address: item.store_address || '',
      distance_miles: item.distance_miles || 0,
      items: [],
      fulfillment: null,
      delivery_fee: 0,
      subtotal: 0,
    };
    cart.store_groups.push(group);
  }

  // Check if product already in this store group (idempotent: increment qty)
  const existing = group.items.find(i => i.product_id === item.product_id);
  if (existing) {
    existing.quantity += item.quantity;
    existing.unit_price = item.unit_price; // Update to latest price
  } else {
    group.items.push({
      id: crypto.randomUUID(),
      store_id: item.store_id,
      store_name: item.store_name,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      image_url: item.image_url || '',
    });
  }

  recalculateTotals(cart);
  cart.status = 'active';
  cart.updated_at = new Date().toISOString();

  logger.info('cart.item_added', 'Item added to cart', {
    cart_id: cart.id,
    user_id: userId,
    product_id: item.product_id,
    store_id: item.store_id,
  });

  return cart;
}

/**
 * Update item quantity. Set to 0 to remove.
 */
export function updateItemQuantity(userId: string, itemId: string, quantity: number): Cart | { error: string } {
  const cart = getOrCreateCart(userId);
  if (cart.status !== 'active' && cart.status !== 'empty') {
    return { error: `Cannot modify items when cart is in '${cart.status}' state` };
  }

  if (quantity < 0 || quantity > 99) {
    return { error: 'Quantity must be between 0 and 99' };
  }

  for (const group of cart.store_groups) {
    const idx = group.items.findIndex(i => i.id === itemId);
    if (idx !== -1) {
      if (quantity === 0) {
        group.items.splice(idx, 1);
        logger.info('cart.item_removed', 'Item removed from cart', { cart_id: cart.id, item_id: itemId });
      } else {
        group.items[idx].quantity = quantity;
        logger.info('cart.item_updated', 'Item quantity updated', { cart_id: cart.id, item_id: itemId, quantity });
      }

      // Remove empty store groups
      cart.store_groups = cart.store_groups.filter(g => g.items.length > 0);
      recalculateTotals(cart);

      if (cart.item_count === 0) cart.status = 'empty';
      cart.updated_at = new Date().toISOString();
      return cart;
    }
  }

  return { error: 'Item not found in cart' };
}

/**
 * Remove item from cart entirely.
 */
export function removeItem(userId: string, itemId: string): Cart | { error: string } {
  return updateItemQuantity(userId, itemId, 0);
}

/**
 * Transition cart to a new status.
 * Enforces valid state transitions per lifecycle spec.
 */
export function transitionCart(cartId: string, newStatus: CartStatus): Cart | { error: string } {
  const cart = carts.get(cartId);
  if (!cart) return { error: 'Cart not found' };

  const allowed = VALID_TRANSITIONS[cart.status];
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot transition from '${cart.status}' to '${newStatus}'` };
  }

  const oldStatus = cart.status;
  cart.status = newStatus;
  cart.updated_at = new Date().toISOString();

  // Set price lock when entering checkout
  if (newStatus === 'checkout') {
    cart.price_locked_at = new Date().toISOString();
  }

  // Clear price lock when leaving checkout flow
  if (newStatus === 'active') {
    cart.price_locked_at = null;
  }

  logger.notice('cart.transition', `Cart ${oldStatus} → ${newStatus}`, {
    cart_id: cartId,
    from: oldStatus,
    to: newStatus,
  });

  return cart;
}

/**
 * Check if price lock is still valid (within 15-minute window).
 */
export function isPriceLockValid(cart: Cart): boolean {
  if (!cart.price_locked_at) return false;
  const lockedAt = new Date(cart.price_locked_at).getTime();
  return Date.now() - lockedAt < PRICE_LOCK_MS;
}

/**
 * Set fulfillment type for a store group.
 */
export function setFulfillment(
  cartId: string,
  storeId: string,
  fulfillment: 'pickup' | 'delivery',
  deliveryFee: number = 0,
): Cart | { error: string } {
  const cart = carts.get(cartId);
  if (!cart) return { error: 'Cart not found' };

  const group = cart.store_groups.find(g => g.store_id === storeId);
  if (!group) return { error: 'Store group not found in cart' };

  group.fulfillment = fulfillment;
  group.delivery_fee = fulfillment === 'delivery' ? deliveryFee : 0;
  recalculateTotals(cart);
  cart.updated_at = new Date().toISOString();

  return cart;
}

/** Get cart by ID */
export function getCart(cartId: string): Cart | null {
  return carts.get(cartId) || null;
}

/** Recalculate all totals */
function recalculateTotals(cart: Cart): void {
  let total = 0;
  let itemCount = 0;

  for (const group of cart.store_groups) {
    let subtotal = 0;
    for (const item of group.items) {
      const discount = item.applied_coupon?.discount || 0;
      subtotal += (item.unit_price - discount) * item.quantity;
      itemCount += item.quantity;
    }
    group.subtotal = Math.round(subtotal * 100) / 100;
    total += group.subtotal + group.delivery_fee;
  }

  cart.total = Math.round(total * 100) / 100;
  cart.item_count = itemCount;
}

/** Clear all carts (testing) */
export function _resetCarts(): void {
  carts.clear();
}
