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
import adsRoutes from './routes/ads.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://localhost', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
app.get('/readyz', (_req, res) => { res.json({ status: 'ok', checks: [] }); });

app.use('/api/v1', adsRoutes);

app.listen(config.PORT, () => {
  logger.notice('ads.startup', `Ads ingestion service listening on port ${config.PORT}`, { port: config.PORT });
});

export default app;
