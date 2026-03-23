// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Request, Response } from 'express';
import { z } from 'zod';
import { crawlForProducts } from '../services/crawl.service.js';

const crawlSchema = z.object({
  query: z.string().min(2).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(1).max(100).optional().default(25),
});

export async function handleCrawl(req: Request, res: Response): Promise<void> {
  const parsed = crawlSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message } });
    return;
  }

  try {
    const result = await crawlForProducts(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: { code: 'CRAWL_FAILED', message: (err as Error).message } });
  }
}
