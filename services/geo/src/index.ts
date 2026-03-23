import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { logger } from './utils/logger.js';
import geoRoutes from './routes/geo.routes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'https://localhost', credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Request ID propagation
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Health checks
app.get('/healthz', (_req, res) => { res.json({ status: 'ok' }); });
app.get('/readyz', (_req, res) => {
  res.json({ status: 'ok', checks: [] });
});

// Mount routes
app.use('/api/v1/geo', geoRoutes);

app.listen(config.PORT, () => {
  logger.notice('geo.startup', `Geo service listening on port ${config.PORT}`, { port: config.PORT });
});

export default app;
