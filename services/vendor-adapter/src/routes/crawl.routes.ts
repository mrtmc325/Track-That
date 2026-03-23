// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Router } from 'express';
import { handleCrawl } from '../controllers/crawl.controller.js';

const router = Router();

// POST /api/v1/crawl — Crawl nearby stores for a product query
router.post('/crawl', handleCrawl);

export default router;
