import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import searchRoutes from './routes/search.routes.js';

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
