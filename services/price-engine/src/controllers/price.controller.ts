// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Request, Response } from 'express';
import { compareSchema, bestDealsSchema } from '../schemas/price.schema.js';
import * as priceService from '../services/price-comparison.service.js';
import { logger } from '../utils/logger.js';

export async function comparePrices(req: Request, res: Response): Promise<void> {
  const parsed = compareSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query' },
    });
    return;
  }

  const { product_id, lat, lng, radius } = parsed.data;
  const result = priceService.compareProductPrices(product_id, lat, lng, radius);

  if ('error' in result) {
    res.status(404).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
}

export async function bestDeals(req: Request, res: Response): Promise<void> {
  const parsed = bestDealsSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query' },
    });
    return;
  }

  const { category, lat, lng, radius, limit } = parsed.data;
  const deals = priceService.getBestDeals(category, lat, lng, radius, limit);
  res.json({ success: true, data: { deals, total: deals.length } });
}

export async function priceHistory(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Store product ID required' } });
    return;
  }

  const history = priceService.getPriceHistory(id);
  res.json({ success: true, data: { history, total: history.length } });
}
