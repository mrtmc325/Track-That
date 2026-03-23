import { describe, it, expect } from 'vitest';
import { searchQuerySchema, addToCartSchema, updateCartItemSchema, setFulfillmentSchema, deliveryWebhookSchema } from '../validation/index.js';

describe('searchQuerySchema', () => {
  it('accepts valid search query', () => {
    const result = searchQuerySchema.safeParse({ q: 'organic apples', lat: 33.45, lng: -112.07 });
    expect(result.success).toBe(true);
  });

  it('rejects query shorter than 2 chars', () => {
    const result = searchQuerySchema.safeParse({ q: 'a' });
    expect(result.success).toBe(false);
  });

  it('rejects query longer than 200 chars', () => {
    const result = searchQuerySchema.safeParse({ q: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('applies defaults for page and page_size', () => {
    const result = searchQuerySchema.parse({ q: 'test' });
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.radius).toBe(25);
  });

  it('rejects radius > 50', () => {
    const result = searchQuerySchema.safeParse({ q: 'test', radius: 100 });
    expect(result.success).toBe(false);
  });

  it('coerces string numbers from query params', () => {
    const result = searchQuerySchema.parse({ q: 'test', lat: '33.45' as any, page: '2' as any });
    expect(result.lat).toBe(33.45);
    expect(result.page).toBe(2);
  });
});

describe('addToCartSchema', () => {
  it('accepts valid cart item', () => {
    const result = addToCartSchema.safeParse({
      store_product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-UUID store_product_id', () => {
    const result = addToCartSchema.safeParse({ store_product_id: 'not-a-uuid', quantity: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects quantity < 1', () => {
    const result = addToCartSchema.safeParse({
      store_product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects quantity > 99', () => {
    const result = addToCartSchema.safeParse({
      store_product_id: '550e8400-e29b-41d4-a716-446655440000',
      quantity: 100,
    });
    expect(result.success).toBe(false);
  });
});

describe('setFulfillmentSchema', () => {
  it('requires delivery_address when fulfillment is delivery', () => {
    const result = setFulfillmentSchema.safeParse({
      store_groups: [{
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        fulfillment: 'delivery',
        // no address
      }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts pickup without address', () => {
    const result = setFulfillmentSchema.safeParse({
      store_groups: [{
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        fulfillment: 'pickup',
      }],
    });
    expect(result.success).toBe(true);
  });

  it('validates ZIP code format', () => {
    const base = {
      store_groups: [{
        store_id: '550e8400-e29b-41d4-a716-446655440000',
        fulfillment: 'delivery' as const,
        delivery_address: { street: '123 Main', city: 'Phoenix', state: 'AZ', zip: 'INVALID' },
      }],
    };
    expect(setFulfillmentSchema.safeParse(base).success).toBe(false);

    base.store_groups[0].delivery_address.zip = '85001';
    expect(setFulfillmentSchema.safeParse(base).success).toBe(true);
  });
});

describe('deliveryWebhookSchema', () => {
  it('accepts valid webhook payload', () => {
    const result = deliveryWebhookSchema.safeParse({
      event: 'delivery_complete',
      delivery_id: 'del-123',
      provider_order_id: 'prov-456',
      timestamp: '2026-03-22T12:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown event types', () => {
    const result = deliveryWebhookSchema.safeParse({
      event: 'unknown_event',
      delivery_id: 'del-123',
      provider_order_id: 'prov-456',
      timestamp: '2026-03-22T12:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid timestamp format', () => {
    const result = deliveryWebhookSchema.safeParse({
      event: 'delivery_complete',
      delivery_id: 'del-123',
      provider_order_id: 'prov-456',
      timestamp: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('validates driver phone_last4 format', () => {
    const result = deliveryWebhookSchema.safeParse({
      event: 'driver_assigned',
      delivery_id: 'del-123',
      provider_order_id: 'prov-456',
      timestamp: '2026-03-22T12:00:00Z',
      driver: { name: 'John', phone_last4: '12345', vehicle: 'Toyota' },
    });
    expect(result.success).toBe(false); // 5 digits, not 4
  });
});
