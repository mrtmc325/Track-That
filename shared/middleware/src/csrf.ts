// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Double-submit CSRF protection
 * Per security.output_encoding_and_injection_prevention
 *
 * Mitigates R7: CSRF/XSS attacks on checkout flow
 *
 * How it works:
 * 1. On GET requests, generate a random CSRF token
 * 2. Set it in a non-HttpOnly cookie (so JS can read it)
 * 3. On state-changing requests (POST/PUT/PATCH/DELETE), require
 *    the token in X-CSRF-Token header matching the cookie value
 * 4. Reject mismatches with 403
 *
 * Combined with SameSite=Strict cookies, this prevents CSRF attacks
 * because an attacker's site cannot read our cookies to send the header.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    // Generate and set CSRF token on safe requests
    const token = crypto.randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,  // Must be readable by frontend JS
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600000, // 1 hour
    });
    next();
    return;
  }

  // Validate CSRF token on state-changing requests
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_MISSING', message: 'CSRF token missing' },
    });
    return;
  }

  // Timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(cookieToken, headerToken)) {
    res.status(403).json({
      success: false,
      error: { code: 'CSRF_INVALID', message: 'CSRF token mismatch' },
    });
    return;
  }

  next();
}

/**
 * Timing-safe string comparison to prevent timing side-channel attacks.
 * Uses crypto.timingSafeEqual under the hood.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
