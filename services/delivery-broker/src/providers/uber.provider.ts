import crypto from 'node:crypto';
import type { DeliveryProvider, DeliveryQuote, DispatchResult, ProviderName } from './provider.interface.js';

export class UberDirectProvider implements DeliveryProvider {
  readonly name: ProviderName = 'uber';
  readonly weightLimitLbs = 25;

  async getQuote(params: {
    pickup_address: string; delivery_address: string; weight_lbs: number; distance_miles: number; item_category: string;
  }): Promise<DeliveryQuote> {
    if (params.weight_lbs > this.weightLimitLbs) {
      return { provider: this.name, estimated_fee: 0, estimated_minutes: 0, weight_limit_lbs: this.weightLimitLbs, available: false, reason: `Exceeds ${this.weightLimitLbs}lb weight limit` };
    }
    const fee = Math.round((4.49 + params.distance_miles * 0.45 + params.weight_lbs * 0.12) * 100) / 100;
    const minutes = Math.round(25 + params.distance_miles * 2.5);
    return { provider: this.name, estimated_fee: fee, estimated_minutes: Math.min(minutes, 60), weight_limit_lbs: this.weightLimitLbs, available: true };
  }

  async dispatch(params: {
    order_id: string; pickup_address: string; delivery_address: string; items: { name: string; quantity: number }[]; weight_lbs: number;
  }): Promise<DispatchResult> {
    return {
      provider: this.name,
      provider_order_id: `ub_${crypto.randomBytes(12).toString('hex')}`,
      tracking_id: `trk_ub_${crypto.randomBytes(8).toString('hex')}`,
      estimated_pickup_time: new Date(Date.now() + 12 * 60000).toISOString(),
      estimated_delivery_time: new Date(Date.now() + 40 * 60000).toISOString(),
    };
  }
}
