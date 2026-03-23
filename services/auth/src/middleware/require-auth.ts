// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware: require a valid JWT access token.
 * Per security.default_deny_and_explicit_allow — endpoints deny by default.
 * Sets req.user = { id, email } for downstream handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
    return;
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
    return;
  }

  // Attach user info for downstream handlers
  (req as any).user = { id: decoded.sub, email: decoded.email };

  // Add user context to request ID for logging
  const requestId = req.headers['x-request-id'] as string || 'none';
  logger.debug('auth.middleware', 'Request authenticated', {
    user_id: decoded.sub,
    request_id: requestId,
  });

  next();
}
