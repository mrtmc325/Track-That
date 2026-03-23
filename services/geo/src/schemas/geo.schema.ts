import { z } from 'zod';

/**
 * Geo endpoint validation schemas.
 * Per security.validate_all_untrusted_input.
 */

export const nearbyStoresSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50).optional().default(25),
  type: z.enum(['grocery', 'clothing', 'department', 'specialty', 'pharmacy', 'convenience']).optional(),
});

export const distanceSchema = z.object({
  from_lat: z.coerce.number().min(-90).max(90),
  from_lng: z.coerce.number().min(-180).max(180),
  store_id: z.string().min(1),
});

export const geocodeSchema = z.object({
  address: z.string().min(2, 'Address must be at least 2 characters').max(500).trim(),
});

export const reverseGeocodeSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export type NearbyStoresQuery = z.infer<typeof nearbyStoresSchema>;
export type DistanceQuery = z.infer<typeof distanceSchema>;
export type GeocodeBody = z.infer<typeof geocodeSchema>;
