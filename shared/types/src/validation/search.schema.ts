import { z } from 'zod';

// Per security.validate_all_untrusted_input — reject malformed queries early
export const searchQuerySchema = z.object({
  q: z.string().min(2, 'Query must be at least 2 characters').max(200, 'Query too long').trim(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).default(25),
  category: z.string().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});

export const suggestQuerySchema = z.object({
  q: z.string().min(1).max(200).trim(),
});

export type ValidatedSearchQuery = z.infer<typeof searchQuerySchema>;
export type ValidatedSuggestQuery = z.infer<typeof suggestQuerySchema>;
