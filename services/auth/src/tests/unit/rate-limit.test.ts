// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginRateLimiter, recordFailedAttempt, clearAttempts, _resetAttempts } from '../../middleware/rate-limit.js';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    body: { email: 'test@example.com' },
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
  };
  return res;
}

describe('Login Rate Limiter', () => {
  beforeEach(() => {
    _resetAttempts();
  });

  it('allows first login attempt', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows up to 5 failed attempts', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('127.0.0.1', 'test@example.com');
    }
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks 6th attempt with 429', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt('127.0.0.1', 'test@example.com');
    }
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('clears attempts on successful login', () => {
    for (let i = 0; i < 4; i++) {
      recordFailedAttempt('127.0.0.1', 'test@example.com');
    }
    clearAttempts('127.0.0.1', 'test@example.com');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('tracks attempts per IP+email combination', () => {
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt('127.0.0.1', 'user1@example.com');
    }
    // Different email should not be blocked
    const req = mockReq({ body: { email: 'user2@example.com' } });
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('locks account after 10 consecutive failures', () => {
    for (let i = 0; i < 10; i++) {
      recordFailedAttempt('127.0.0.1', 'locked@example.com');
    }
    const req = mockReq({ body: { email: 'locked@example.com' } });
    const res = mockRes();
    const next = vi.fn();
    loginRateLimiter(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });
});
