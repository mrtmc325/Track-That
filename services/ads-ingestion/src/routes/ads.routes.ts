import { Router } from 'express';
import * as adsController from '../controllers/ads.controller.js';

const router = Router();

router.get('/coupons', adsController.getCoupons);
router.get('/deals/today', adsController.getTodayDeals);
router.get('/flyers/:store_id', adsController.getFlyer);

export default router;
