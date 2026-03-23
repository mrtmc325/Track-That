// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Router } from 'express';
import * as adsController from '../controllers/ads.controller.js';

const router = Router();

router.get('/coupons', adsController.getCoupons);
router.get('/deals/today', adsController.getTodayDeals);
router.get('/flyers/:store_id', adsController.getFlyer);

export default router;
