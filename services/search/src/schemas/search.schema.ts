import { z } from 'zod';

/**
 * Search endpoint validation schemas.
 * Per security.validate_all_untrusted_input.
 */

export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(200, 'Query too long'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).optional().default(25),
  category: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  page_size: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const suggestSchema = z.object({
  q: z.string().min(2).max(100),
});

export const productIdSchema = z.object({
  id: z.string().uuid(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SuggestQuery = z.infer<typeof suggestSchema>;
