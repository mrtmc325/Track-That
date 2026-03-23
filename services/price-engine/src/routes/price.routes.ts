import { Router } from 'express';
import * as priceController from '../controllers/price.controller.js';

const router = Router();

// GET /api/v1/prices/compare?product_id=&lat=&lng=&radius=
router.get('/compare', priceController.comparePrices);

// GET /api/v1/prices/best-deals?category=&lat=&lng=&limit=
router.get('/best-deals', priceController.bestDeals);

// GET /api/v1/prices/history/:id
router.get('/history/:id', priceController.priceHistory);

export default router;
