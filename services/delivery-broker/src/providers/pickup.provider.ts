import type { DeliveryProvider, DeliveryQuote, DispatchResult, ProviderName } from './provider.interface.js';

export class PickupProvider implements DeliveryProvider {
  readonly name: ProviderName = 'pickup';
  readonly weightLimitLbs = Infinity;

  async getQuote(params: {
    pickup_address: string; delivery_address: string; weight_lbs: number; distance_miles: number; item_category: string;
  }): Promise<DeliveryQuote> {
    return { provider: this.name, estimated_fee: 0, estimated_minutes: 0, weight_limit_lbs: Infinity, available: true };
  }

  async dispatch(params: {
    order_id: string; pickup_address: string; delivery_address: string; items: { name: string; quantity: number }[]; weight_lbs: number;
  }): Promise<DispatchResult> {
    return {
      provider: this.name,
      provider_order_id: `pickup_${params.order_id}`,
      tracking_id: `pickup_${params.order_id}`,
      estimated_pickup_time: 'user_defined',
      estimated_delivery_time: 'user_defined',
    };
  }
}
