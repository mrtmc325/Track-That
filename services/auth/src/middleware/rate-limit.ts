// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Login attempt rate limiter
 * Per security.strong_authn_and_centralized_authz
 *
 * Rules:
 * - 5 failed login attempts per 15-minute window per IP+email combination
 * - Account lockout after 10 consecutive failures (30-minute cooldown)
 * - Uses in-memory store (Redis in production)
 */

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  locked: boolean;
  lockExpires: number;
}

const WINDOW_MS = 15 * 60 * 1000;          // 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_THRESHOLD = 10;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// In-memory store keyed by IP:email
const attempts = new Map<string, AttemptRecord>();

export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = req.body?.email || 'unknown';
  const key = `${ip}:${email}`;

  const now = Date.now();
  let record = attempts.get(key);

  // Clean up expired windows
  if (record && now - record.firstAttempt > WINDOW_MS && !record.locked) {
    attempts.delete(key);
    record = undefined;
  }

  // Check lockout
  if (record?.locked) {
    if (now < record.lockExpires) {
      const retryAfterSec = Math.ceil((record.lockExpires - now) / 1000);
      logger.warning('auth.rate_limit', 'Account locked', { ip, key });
      res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many failed attempts. Try again later.' },
        retry_after_seconds: retryAfterSec,
      });
      return;
    }
    // Lockout expired
    attempts.delete(key);
    record = undefined;
  }

  // Check attempt count
  if (record && record.count >= MAX_ATTEMPTS) {
    logger.warning('auth.rate_limit', 'Rate limit exceeded', { ip, key, count: record.count });
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many login attempts. Please wait.' },
      retry_after_seconds: Math.ceil((record.firstAttempt + WINDOW_MS - now) / 1000),
    });
    return;
  }

  next();
}

/**
 * Record a failed login attempt. Call this after failed auth.
 */
export function recordFailedAttempt(ip: string, email: string): void {
  const key = `${ip}:${email}`;
  const now = Date.now();

  let record = attempts.get(key);
  if (!record || now - record.firstAttempt > WINDOW_MS) {
    record = { count: 0, firstAttempt: now, locked: false, lockExpires: 0 };
  }

  record.count++;

  if (record.count >= LOCKOUT_THRESHOLD) {
    record.locked = true;
    record.lockExpires = now + LOCKOUT_DURATION_MS;
    logger.alert('auth.lockout', 'Account locked after repeated failures', { ip, key, count: record.count });
  }

  attempts.set(key, record);
}

/**
 * Clear attempts on successful login.
 */
export function clearAttempts(ip: string, email: string): void {
  attempts.delete(`${ip}:${email}`);
}

/** Reset for testing */
export function _resetAttempts(): void {
  attempts.clear();
}
