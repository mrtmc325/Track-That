import { z } from 'zod';

/**
 * Price engine endpoint validation schemas.
 * Per security.validate_all_untrusted_input.
 */

export const compareSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).optional().default(25),
});

export const bestDealsSchema = z.object({
  category: z.string().max(50).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).optional().default(25),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const historySchema = z.object({
  store_product_id: z.string().min(1, 'Store product ID required'),
});

export type CompareQuery = z.infer<typeof compareSchema>;
export type BestDealsQuery = z.infer<typeof bestDealsSchema>;
