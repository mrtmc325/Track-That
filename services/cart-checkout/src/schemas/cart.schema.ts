// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { z } from 'zod';

export const addItemSchema = z.object({
  store_id: z.string().min(1),
  store_name: z.string().min(1).max(200),
  store_address: z.string().max(500).optional(),
  distance_miles: z.number().min(0).max(100).optional(),
  product_id: z.string().min(1),
  product_name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(99),
  unit_price: z.number().min(0).max(100000),
  image_url: z.string().max(2000).optional(),
});

export const updateQuantitySchema = z.object({
  quantity: z.number().int().min(0).max(99),
});

export const setFulfillmentSchema = z.object({
  store_id: z.string().min(1),
  fulfillment: z.enum(['pickup', 'delivery']),
  delivery_fee: z.number().min(0).max(1000).optional().default(0),
});

export const completeCheckoutSchema = z.object({
  payment_intent_id: z.string().min(1),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type SetFulfillmentInput = z.infer<typeof setFulfillmentSchema>;
