import { z } from 'zod';

export const quoteSchema = z.object({
  pickup_address: z.string().min(5).max(500),
  delivery_address: z.string().min(5).max(500),
  weight_lbs: z.number().min(0.1).max(500),
  distance_miles: z.number().min(0).max(100),
  item_category: z.string().min(1).max(50),
});

export const dispatchSchema = z.object({
  provider: z.string().min(1),
  order_id: z.string().min(1),
  pickup_address: z.string().min(5).max(500),
  delivery_address: z.string().min(5).max(500),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int().min(1) })).min(1),
  weight_lbs: z.number().min(0.1).max(500),
});

export const webhookPayloadSchema = z.object({
  event: z.enum(['driver_assigned', 'pickup_complete', 'delivery_complete', 'delivery_failed', 'delivery_cancelled']),
  delivery_id: z.string().min(1),
  provider_order_id: z.string().min(1),
  timestamp: z.string(),
  event_id: z.string().optional(),
  driver: z.object({
    name: z.string(),
    phone_last4: z.string().length(4),
    vehicle: z.string(),
  }).optional(),
  eta_minutes: z.number().optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type DispatchInput = z.infer<typeof dispatchSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
