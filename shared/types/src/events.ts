/** Emitted by the price-tracker service when a product price changes at a store. */
export interface PriceUpdateEvent {
  product_id: string;
  store_id: string;
  old_price: number;
  new_price: number;
  timestamp: string; // ISO 8601
}

/** Emitted by the order service when a new order is placed. */
export interface OrderCreatedEvent {
  order_id: string;
  user_id: string;
  store_groups: {
    store_id: string;
    item_count: number;
    subtotal: number;
  }[];
  timestamp: string; // ISO 8601
}

/** Emitted by the delivery service when the status of a delivery changes. */
export interface DeliveryStatusEvent {
  delivery_id: string;
  order_store_group_id: string;
  status: string;
  provider: string;
  timestamp: string; // ISO 8601
}
