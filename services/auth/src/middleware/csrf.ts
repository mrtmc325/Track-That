// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * CSRF double-submit cookie pattern.
 * Per security.output_encoding_and_injection_prevention — prevent CSRF attacks.
 *
 * How it works:
 * 1. On login/register, a random CSRF token is set in a cookie (readable by JS)
 *    AND returned in a response header.
 * 2. On state-changing requests (POST/PATCH/DELETE), the client must send
 *    the token in the X-CSRF-Token header.
 * 3. This middleware compares the header value against the cookie value.
 *
 * SameSite=Strict cookies provide primary CSRF defense; this is defense-in-depth.
 */

const CSRF_COOKIE = 'csrf_token';
const CSRF_HEADER = 'x-csrf-token';

/** Generate a new CSRF token and set it as a cookie. */
export function setCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // Must be readable by JS to send in header
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });
  res.setHeader('X-CSRF-Token', token);
  return token;
}

/**
 * Validate CSRF token on state-changing requests.
 * Safe methods (GET, HEAD, OPTIONS) are exempt.
 */
export function validateCsrf(req: Request, res: Response, next: NextFunction): void {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string;

  if (!cookieToken || !headerToken) {
    logger.warning('auth.csrf', 'CSRF token missing', {
      has_cookie: !!cookieToken,
      has_header: !!headerToken,
      path: req.path,
    });
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_FAILED', message: 'CSRF token missing' },
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warning('auth.csrf', 'CSRF token mismatch', { path: req.path });
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_FAILED', message: 'CSRF token invalid' },
    });
    return;
  }

  next();
}
