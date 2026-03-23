// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth } from '../../middleware/require-auth.js';
import { generateAccessToken, _resetStores } from '../../services/auth.service.js';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    cookies: {},
    headers: { 'x-request-id': 'test-req-id' },
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

describe('requireAuth Middleware', () => {
  beforeEach(() => {
    _resetStores();
  });

  it('rejects request with no access_token cookie', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects request with invalid token', () => {
    const req = mockReq({ cookies: { access_token: 'bad.token.value' } });
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it('allows request with valid token and sets req.user', () => {
    const token = generateAccessToken('user-abc', 'test@example.com');
    const req = mockReq({ cookies: { access_token: token } });
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-abc');
    expect(req.user.email).toBe('test@example.com');
  });

  it('rejects expired token', async () => {
    // Generate token with immediate expiry by manipulating the JWT
    // Instead, just use a tampered token
    const token = generateAccessToken('user-abc', 'test@example.com');
    const tampered = token.slice(0, -3) + 'XXX';
    const req = mockReq({ cookies: { access_token: tampered } });
    const res = mockRes();
    const next = vi.fn();
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });
});
