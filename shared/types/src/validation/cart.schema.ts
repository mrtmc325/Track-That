import { z } from 'zod';

export const addToCartSchema = z.object({
  store_product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

const deliveryAddressSchema = z.object({
  street: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code'),
});

export const setFulfillmentSchema = z.object({
  store_groups: z.array(z.object({
    store_id: z.string().uuid(),
    fulfillment: z.enum(['pickup', 'delivery']),
    delivery_address: deliveryAddressSchema.optional(),
  })).min(1).refine(
    // If fulfillment is delivery, address is required
    (groups) => groups.every(g => g.fulfillment !== 'delivery' || g.delivery_address),
    { message: 'Delivery address required for delivery fulfillment' }
  ),
});

export const paymentRequestSchema = z.object({
  checkout_id: z.string().uuid(),
});
