/**
 * Delivery Provider Interface
 * Per Phase 8 spec: abstracts over multiple last-mile delivery APIs.
 * All providers implement this common contract.
 */

export type ProviderName = 'doordash' | 'uber' | 'usps' | 'store_delivery' | 'pickup';

export interface DeliveryQuote {
  provider: ProviderName;
  estimated_fee: number;
  estimated_minutes: number;
  weight_limit_lbs: number;
  available: boolean;
  reason?: string; // If not available, why
}

export interface DispatchResult {
  provider: ProviderName;
  provider_order_id: string;
  tracking_id: string;
  estimated_pickup_time: string;
  estimated_delivery_time: string;
}

export interface DeliveryProvider {
  readonly name: ProviderName;
  readonly weightLimitLbs: number;

  /** Get a delivery quote for the given parameters */
  getQuote(params: {
    pickup_address: string;
    delivery_address: string;
    weight_lbs: number;
    distance_miles: number;
    item_category: string;
  }): Promise<DeliveryQuote>;

  /** Dispatch a delivery order */
  dispatch(params: {
    order_id: string;
    pickup_address: string;
    delivery_address: string;
    items: { name: string; quantity: number }[];
    weight_lbs: number;
  }): Promise<DispatchResult>;
}
