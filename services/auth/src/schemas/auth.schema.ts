import { z } from 'zod';

// Per security.validate_all_untrusted_input — all auth inputs validated server-side

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255).trim().toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  display_name: z.string().min(1).max(100).trim(),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refresh_token: z.string().uuid(),
});

export const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).trim().optional(),
  default_location_lat: z.number().min(-90).max(90).optional(),
  default_location_lng: z.number().min(-180).max(180).optional(),
  search_radius_miles: z.number().int().min(1).max(50).optional(),
  preferred_categories: z.array(z.string().max(50)).max(20).optional(),
  notify_price_drops: z.boolean().optional(),
  notify_deal_alerts: z.boolean().optional(),
  notify_order_updates: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(128)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
