// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi } from 'vitest';
import { setCsrfToken, validateCsrf } from '../../middleware/csrf.js';

function mockReq(overrides: Record<string, any> = {}) {
  return {
    method: 'POST',
    path: '/test',
    cookies: {},
    headers: {},
    ...overrides,
  } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    cookies: {} as Record<string, { value: string; options: any }>,
    responseHeaders: {} as Record<string, string>,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
    cookie(name: string, value: string, options: any) {
      res.cookies[name] = { value, options };
      return res;
    },
    setHeader(name: string, value: string) {
      res.responseHeaders[name] = value;
      return res;
    },
  };
  return res;
}

describe('CSRF Middleware', () => {
  describe('setCsrfToken', () => {
    it('sets a csrf_token cookie readable by JS', () => {
      const res = mockRes();
      const token = setCsrfToken(res);
      expect(token).toBeDefined();
      expect(token.length).toBe(64); // 32 bytes hex
      expect(res.cookies['csrf_token']).toBeDefined();
      expect(res.cookies['csrf_token'].options.httpOnly).toBe(false); // Must be JS-readable
      expect(res.cookies['csrf_token'].options.secure).toBe(true);
      expect(res.cookies['csrf_token'].options.sameSite).toBe('strict');
    });

    it('sets X-CSRF-Token response header', () => {
      const res = mockRes();
      const token = setCsrfToken(res);
      expect(res.responseHeaders['X-CSRF-Token']).toBe(token);
    });
  });

  describe('validateCsrf', () => {
    it('allows GET requests without CSRF token', () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows HEAD requests without CSRF token', () => {
      const req = mockReq({ method: 'HEAD' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows OPTIONS requests without CSRF token', () => {
      const req = mockReq({ method: 'OPTIONS' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects POST without CSRF token', () => {
      const req = mockReq({ method: 'POST' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('CSRF_FAILED');
    });

    it('rejects POST with cookie but no header', () => {
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: 'abc123' },
      });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('rejects POST with mismatched tokens', () => {
      const token = 'a'.repeat(64);
      const badToken = 'b'.repeat(64);
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': badToken },
      });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('allows POST with matching tokens', () => {
      const token = 'a'.repeat(64);
      const req = mockReq({
        method: 'POST',
        cookies: { csrf_token: token },
        headers: { 'x-csrf-token': token },
      });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('rejects PATCH without CSRF token', () => {
      const req = mockReq({ method: 'PATCH' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });

    it('rejects DELETE without CSRF token', () => {
      const req = mockReq({ method: 'DELETE' });
      const res = mockRes();
      const next = vi.fn();
      validateCsrf(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
    });
  });
});
