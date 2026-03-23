import { z } from 'zod';

// Webhook payload validation with strict schema
// Per security.validate_all_untrusted_input — external webhook data is untrusted
export const deliveryWebhookSchema = z.object({
  event: z.enum([
    'driver_assigned',
    'pickup_complete',
    'delivery_complete',
    'delivery_failed',
    'delivery_cancelled',
  ]),
  delivery_id: z.string().min(1).max(255),
  provider_order_id: z.string().min(1).max(255),
  timestamp: z.string().datetime(),
  driver: z.object({
    name: z.string().min(1).max(100),
    phone_last4: z.string().regex(/^\d{4}$/),
    vehicle: z.string().min(1).max(100),
  }).optional(),
  eta_minutes: z.number().int().min(0).max(999).optional(),
});

export const deliveryQuoteRequestSchema = z.object({
  order_store_group_id: z.string().uuid(),
  pickup_address: z.string().min(1).max(500),
  delivery_address: z.string().min(1).max(500),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    quantity: z.number().int().min(1),
    weight_lbs: z.number().min(0.01).max(500),
  })).min(1),
  total_weight_lbs: z.number().min(0.01).max(2000),
});
