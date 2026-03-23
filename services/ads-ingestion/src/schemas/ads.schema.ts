// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { z } from 'zod';

export const couponsQuerySchema = z.object({
  store_id: z.string().optional(),
  product_id: z.string().optional(),
  category: z.string().max(50).optional(),
  active: z.enum(['true', 'false']).optional().default('true'),
});

export const todayDealsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(1).max(50).optional().default(25),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export type CouponsQuery = z.infer<typeof couponsQuerySchema>;
export type TodayDealsQuery = z.infer<typeof todayDealsSchema>;
