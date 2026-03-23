// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// API Contract: Delivery Broker
// Per security.validate_all_untrusted_input — webhook payloads validated with HMAC + Zod
// Per reliability.idempotent_and_retry_safe_interfaces — replay protection via timestamp + nonce

export type DeliveryEvent =
  | 'driver_assigned'
  | 'pickup_complete'
  | 'delivery_complete'
  | 'delivery_failed'
  | 'delivery_cancelled';

export type DeliveryStatus =
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'in_transit'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface DeliveryDriver {
  name: string;
  phone_last4: string;
  vehicle: string;
}

export interface DeliveryWebhookPayload {
  event: DeliveryEvent;
  delivery_id: string;
  provider_order_id: string;
  timestamp: string; // ISO 8601
  driver?: DeliveryDriver;
  eta_minutes?: number;
}

export interface DeliveryQuoteRequest {
  order_store_group_id: string;
  pickup_address: string;
  delivery_address: string;
  items: {
    name: string;
    quantity: number;
    weight_lbs: number;
  }[];
  total_weight_lbs: number;
}

export interface DeliveryQuote {
  provider: string;
  estimated_fee: number;
  estimated_minutes: number;
  available: boolean;
}

export interface DeliveryQuoteResponse {
  quotes: DeliveryQuote[];
  recommended: string; // provider name
}

export interface DeliveryStatusResponse {
  delivery_id: string;
  status: DeliveryStatus;
  provider: string;
  driver?: DeliveryDriver;
  eta_minutes?: number;
  updated_at: string;
}
