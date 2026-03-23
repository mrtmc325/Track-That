// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Router } from 'express';
import * as deliveryController from '../controllers/delivery.controller.js';

const router = Router();

// POST /api/v1/delivery/quote — Get quotes
router.post('/quote', deliveryController.getQuotes);

// POST /api/v1/delivery/dispatch — Internal dispatch
router.post('/dispatch', deliveryController.dispatchDelivery);

// GET /api/v1/delivery/:id/status — Track delivery
router.get('/:id/status', deliveryController.getDeliveryStatus);

// POST /api/v1/delivery/webhook/:provider — Inbound webhooks
router.post('/webhook/:provider', deliveryController.handleWebhook);

export default router;
