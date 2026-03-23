// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// API Contract: Cart & Checkout
// Per reliability.idempotent_and_retry_safe_interfaces — cart ops use idempotency keys

export type CartStatus = 'empty' | 'active' | 'checkout' | 'payment_pending' | 'processing';
export type FulfillmentType = 'pickup' | 'delivery';

export interface CartStore {
  id: string;
  name: string;
  address: string;
  distance_miles: number;
}

export interface AppliedCoupon {
  code: string;
  discount: number;
}

export interface CartItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  applied_coupon?: AppliedCoupon;
  image_url: string;
}

export interface CartStoreGroup {
  store: CartStore;
  items: CartItem[];
  fulfillment: FulfillmentType | null;
  delivery_fee?: number;
  subtotal: number;
}

export interface CartResponse {
  id: string;
  status: CartStatus;
  store_groups: CartStoreGroup[];
  total: number;
  item_count: number;
}

export interface AddToCartRequest {
  store_product_id: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}

export interface SetFulfillmentRequest {
  store_groups: {
    store_id: string;
    fulfillment: FulfillmentType;
    delivery_address?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
  }[];
}

export interface CheckoutInitiateResponse {
  checkout_id: string;
  price_lock_expires_at: string; // ISO 8601, 15-min window
  store_groups: CartStoreGroup[];
  total: number;
}

export interface PaymentRequest {
  checkout_id: string;
}

export interface PaymentResponse {
  client_secret: string; // Stripe PaymentIntent client_secret
}

export interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  placed_at: string;
  store_groups: {
    store_name: string;
    fulfillment_method: FulfillmentType;
    delivery_tracking_id?: string;
    subtotal: number;
    delivery_fee: number;
    status: string;
  }[];
}
