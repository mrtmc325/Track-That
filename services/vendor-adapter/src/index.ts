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
import crawlRoutes from './routes/crawl.routes.js';

const app = express();

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
  // TODO: Add dependency checks (DB, Redis, Elasticsearch, BullMQ) when connected
  res.json({ status: 'ok', checks: [] });
});

// Mount crawl API for inter-service calls from search service
app.use('/api/v1', crawlRoutes);

app.listen(config.PORT, () => {
  logger.notice('vendor-adapter.startup', `Vendor-adapter service listening on port ${config.PORT}`, { port: config.PORT });
});

export default app;
