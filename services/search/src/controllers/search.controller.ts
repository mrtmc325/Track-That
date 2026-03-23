// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Request, Response } from 'express';
import { searchQuerySchema, suggestSchema } from '../schemas/search.schema.js';
import * as searchService from '../services/search.service.js';
import { logger } from '../utils/logger.js';

/**
 * Search controller — handles HTTP concerns and delegates to service.
 * operability.observability_by_default — logs all requests with timing.
 */

export async function searchProducts(req: Request, res: Response): Promise<void> {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Invalid query' },
    });
    return;
  }

  const { q, lat, lng, radius, category, page, page_size } = parsed.data;

  // Check if user is authenticated (has access_token cookie)
  // Authenticated users get full crawl-then-search with anti-detection proxy behavior
  // Anonymous users get cached results only (no crawl triggered)
  const isAuthenticated = !!(req.cookies?.access_token || req.headers.cookie?.includes('access_token'));

  const result = await searchService.searchWithCrawl({
    q,
    lat,
    lng,
    radius,
    category,
    page,
    pageSize: page_size,
  }, isAuthenticated);

  if ('error' in result) {
    res.status(400).json({ success: false, error: result.error });
    return;
  }

  res.json({ success: true, data: result });
}

export async function suggestProducts(req: Request, res: Response): Promise<void> {
  const parsed = suggestSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Query parameter required (min 2 chars)' },
    });
    return;
  }

  const suggestions = searchService.suggest(parsed.data.q);
  res.json({ success: true, data: { suggestions } });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Product ID required' } });
    return;
  }

  const product = searchService.getProduct(id);
  if (!product) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    return;
  }

  res.json({ success: true, data: product });
}

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const categories = searchService.getCategories();
  res.json({ success: true, data: { categories } });
}
