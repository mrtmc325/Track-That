// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import searchRoutes from './routes/search.routes.js';
import { indexProduct } from './services/search.service.js';

const app = express();

// Seed demo products on startup so search returns results immediately
function seedDemoProducts() {
  const stores = [
    { store_id: 'store-frys', store_name: "Fry's Food & Drug", current_price: 5.49, original_price: 6.99, on_sale: true, store_rating: 4.3, location: { lat: 33.5087, lon: -112.0191 }, last_updated: new Date().toISOString() },
    { store_id: 'store-sprouts', store_name: 'Sprouts Farmers Market', current_price: 5.99, original_price: 5.99, on_sale: false, store_rating: 4.6, location: { lat: 33.5049, lon: -112.0622 }, last_updated: new Date().toISOString() },
  ];
  const clothingStores = [
    { store_id: 'store-hm', store_name: 'H&M Fashion District', current_price: 29.99, original_price: 39.99, on_sale: true, store_rating: 4.1, location: { lat: 33.5678, lon: -112.1019 }, last_updated: new Date().toISOString() },
    { store_id: 'store-oldnavy', store_name: 'Old Navy Scottsdale', current_price: 24.99, original_price: 34.99, on_sale: true, store_rating: 4.2, location: { lat: 33.5091, lon: -111.9267 }, last_updated: new Date().toISOString() },
  ];

  const products = [
    { product_id: 'prod-milk', canonical_name: 'Organic Whole Milk', category: 'grocery', subcategory: 'dairy', brand: 'Horizon Organic', description: 'USDA certified organic whole milk, 1 gallon', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 5.49 + Math.random() })) },
    { product_id: 'prod-eggs', canonical_name: 'Cage-Free Large Eggs', category: 'grocery', subcategory: 'dairy', brand: 'Vital Farms', description: 'Pasture-raised cage-free large brown eggs, 12 count', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 7.99 + Math.random() * 2 })) },
    { product_id: 'prod-bread', canonical_name: 'Sourdough Bread', category: 'grocery', subcategory: 'bakery', brand: "Dave's Killer Bread", description: 'Organic sourdough sandwich bread, 24 oz', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 5.99 + Math.random() })) },
    { product_id: 'prod-avocados', canonical_name: 'Hass Avocados', category: 'grocery', subcategory: 'produce', brand: 'Organic Girl', description: 'Organic Hass avocados, bag of 4', image_url: '', store_listings: [{ ...stores[1], current_price: 4.99, original_price: 5.99, on_sale: true }] },
    { product_id: 'prod-spinach', canonical_name: 'Baby Spinach', category: 'grocery', subcategory: 'produce', brand: 'Earthbound Farm', description: 'Organic baby spinach, 5 oz container', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 3.49 + Math.random() })) },
    { product_id: 'prod-chicken', canonical_name: 'Chicken Breast', category: 'grocery', subcategory: 'meat', brand: 'Farm Fresh', description: 'Boneless skinless chicken breast fillets', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 8.99 + Math.random() * 3 })) },
    { product_id: 'prod-apples', canonical_name: 'Organic Apples', category: 'grocery', subcategory: 'produce', brand: 'Nature Best', description: 'Fresh organic gala apples, locally grown', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 4.99 + Math.random() })) },
    { product_id: 'prod-water', canonical_name: 'Sparkling Water 12-Pack', category: 'grocery', subcategory: 'beverages', brand: 'LaCroix', description: 'Naturally essenced sparkling water, variety pack', image_url: '', store_listings: stores.map(s => ({ ...s, current_price: 5.99 + Math.random() * 2 })) },
    { product_id: 'prod-jeans', canonical_name: "Women's Slim Fit Jeans", category: 'clothing', subcategory: 'bottoms', brand: 'H&M', description: "Women's slim fit stretch jeans, mid-rise", image_url: '', store_listings: clothingStores.map(s => ({ ...s, current_price: 29.99 + Math.random() * 10 })) },
    { product_id: 'prod-tshirt', canonical_name: "Men's Classic T-Shirt", category: 'clothing', subcategory: 'tops', brand: 'H&M', description: "Men's 100% cotton crew-neck tee", image_url: '', store_listings: clothingStores.map(s => ({ ...s, current_price: 12.99 + Math.random() * 5 })) },
    { product_id: 'prod-hoodie', canonical_name: "Women's Pullover Hoodie", category: 'clothing', subcategory: 'outerwear', brand: 'Old Navy', description: "Women's cozy sherpa pullover hoodie", image_url: '', store_listings: [{ ...clothingStores[1], current_price: 34.99, original_price: 49.99, on_sale: true }] },
    { product_id: 'prod-joggers', canonical_name: "Men's Jogger Pants", category: 'clothing', subcategory: 'bottoms', brand: 'Old Navy', description: "Men's go-dry performance jogger pants", image_url: '', store_listings: clothingStores.map(s => ({ ...s, current_price: 24.99 + Math.random() * 5 })) },
  ];

  for (const p of products) {
    indexProduct(p);
  }
  logger.notice('search.seed', `Seeded ${products.length} demo products`, { count: products.length });
}

seedDemoProducts();

// Security middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://localhost', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Request ID propagation per operability.observability_by_default
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Health checks
app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
app.get('/readyz', (_req, res) => {
  // TODO: Add Elasticsearch health check when connected
  res.json({ status: 'ok', checks: [] });
});

// Mount routes — auth middleware would be applied at gateway level
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1', searchRoutes); // Also mount products/:id and categories at /api/v1/

app.listen(config.PORT, () => {
  logger.notice('search.startup', `Search service listening on port ${config.PORT}`, { port: config.PORT });
});

export default app;
