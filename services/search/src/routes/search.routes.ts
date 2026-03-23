import { Router } from 'express';
import * as searchController from '../controllers/search.controller.js';

const router = Router();

// GET /api/v1/search?q=&lat=&lng=&radius=&category=&page= — Full search
router.get('/', searchController.searchProducts);

// GET /api/v1/search/suggest?q= — Autocomplete
router.get('/suggest', searchController.suggestProducts);

// GET /api/v1/products/:id — Product detail
router.get('/products/:id', searchController.getProduct);

// GET /api/v1/categories — List categories
router.get('/categories', searchController.getCategories);

export default router;
