// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi } from 'vitest';
import { csrfProtection } from '../csrf.js';

function mockReq(overrides = {}) {
  return { method: 'GET', cookies: {}, headers: {}, body: {}, ...overrides } as any;
}

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    cookies: {} as Record<string, any>,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
    cookie(name: string, value: any, opts: any) { res.cookies[name] = { value, opts }; return res; },
    setHeader(name: string, val: string) { res.headers[name] = val; return res; },
  };
  return res;
}

describe('csrfProtection', () => {
  it('sets a CSRF cookie on GET requests', () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.cookies['_csrf']).toBeDefined();
    expect(res.cookies['_csrf'].value).toMatch(/^[a-f0-9]{64}$/);
    expect(res.cookies['_csrf'].opts.httpOnly).toBe(false);
    expect(res.cookies['_csrf'].opts.sameSite).toBe('strict');
  });

  it('sets a CSRF cookie on HEAD requests', () => {
    const req = mockReq({ method: 'HEAD' });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.cookies['_csrf']).toBeDefined();
  });

  it('returns 403 when POST request has no CSRF token', () => {
    const req = mockReq({ method: 'POST', cookies: {}, headers: {} });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('CSRF_MISSING');
  });

  it('returns 403 when POST request has mismatched CSRF tokens', () => {
    const req = mockReq({
      method: 'POST',
      cookies: { _csrf: 'a'.repeat(64) },
      headers: { 'x-csrf-token': 'b'.repeat(64) },
    });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('CSRF_INVALID');
  });

  it('calls next when POST request has matching CSRF tokens', () => {
    const token = 'c'.repeat(64);
    const req = mockReq({
      method: 'POST',
      cookies: { _csrf: token },
      headers: { 'x-csrf-token': token },
    });
    const res = mockRes();
    const next = vi.fn();

    csrfProtection(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});
