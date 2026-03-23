// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// Client-side response types — mirrored from @track-that/types contracts

export type CartStatus = 'empty' | 'active' | 'checkout' | 'payment_pending' | 'processing';
export type FulfillmentType = 'pickup' | 'delivery';

export type DeliveryStatus =
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface ProductSummary {
  id: string;
  name: string;
  category: string;
  brand: string;
  image_url: string;
  description: string;
}

export interface BestPrice {
  store_name: string;
  price: number;
  distance_miles: number;
  on_sale: boolean;
  coupon_available: boolean;
}

export interface StoreListing {
  store_id: string;
  store_name: string;
  price: number;
  original_price: number;
  distance_miles: number;
  store_rating: number;
}

export interface SearchResult {
  product: ProductSummary;
  best_price: BestPrice;
  listings: StoreListing[];
}

export interface SearchMetadata {
  normalized_query: string;
  fuzzy_applied: boolean;
  response_time_ms: number;
}

export interface SearchResponse {
  query: string;
  total_results: number;
  results: SearchResult[];
  similar_items: SearchResult[];
  search_metadata: SearchMetadata;
}

export interface SuggestResponse {
  suggestions: string[];
}

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

export interface DeliveryDriver {
  name: string;
  phone_last4: string;
  vehicle: string;
}

export interface DeliveryStatusResponse {
  delivery_id: string;
  status: DeliveryStatus;
  provider: string;
  driver?: DeliveryDriver;
  eta_minutes?: number;
  updated_at: string;
}
