// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * DoorDash Drive adapter (mock for dev).
 * In production: calls DoorDash Drive REST API via HTTPS.
 * Weight limit: 30 lbs, ETA: 30-60 min.
 */
import crypto from 'node:crypto';
import type { DeliveryProvider, DeliveryQuote, DispatchResult, ProviderName } from './provider.interface.js';

export class DoorDashProvider implements DeliveryProvider {
  readonly name: ProviderName = 'doordash';
  readonly weightLimitLbs = 30;

  async getQuote(params: {
    pickup_address: string;
    delivery_address: string;
    weight_lbs: number;
    distance_miles: number;
    item_category: string;
  }): Promise<DeliveryQuote> {
    if (params.weight_lbs > this.weightLimitLbs) {
      return { provider: this.name, estimated_fee: 0, estimated_minutes: 0, weight_limit_lbs: this.weightLimitLbs, available: false, reason: `Exceeds ${this.weightLimitLbs}lb weight limit` };
    }
    // Mock pricing: base $3.99 + $0.50/mile + $0.10/lb
    const fee = Math.round((3.99 + params.distance_miles * 0.50 + params.weight_lbs * 0.10) * 100) / 100;
    const minutes = Math.round(30 + params.distance_miles * 3); // ~3 min/mile
    return { provider: this.name, estimated_fee: fee, estimated_minutes: Math.min(minutes, 60), weight_limit_lbs: this.weightLimitLbs, available: true };
  }

  async dispatch(params: {
    order_id: string;
    pickup_address: string;
    delivery_address: string;
    items: { name: string; quantity: number }[];
    weight_lbs: number;
  }): Promise<DispatchResult> {
    const providerOrderId = `dd_${crypto.randomBytes(12).toString('hex')}`;
    return {
      provider: this.name,
      provider_order_id: providerOrderId,
      tracking_id: `trk_dd_${crypto.randomBytes(8).toString('hex')}`,
      estimated_pickup_time: new Date(Date.now() + 15 * 60000).toISOString(),
      estimated_delivery_time: new Date(Date.now() + 45 * 60000).toISOString(),
    };
  }
}
