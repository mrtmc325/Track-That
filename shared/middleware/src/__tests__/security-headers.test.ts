import { describe, it, expect, vi } from 'vitest';
import { securityHeaders, CSP_HEADER, PERMISSIONS_POLICY_HEADER } from '../security-headers.js';

function mockReq() {
  return {} as any;
}

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader(name: string, value: string) { headers[name] = value; },
  } as any;
}

describe('Security Headers Middleware (Phase 10 Section 10.3)', () => {
  it('sets Content-Security-Policy', () => {
    const res = mockRes();
    const next = vi.fn();
    securityHeaders(mockReq(), res, next);
    expect(res.headers['Content-Security-Policy']).toBe(CSP_HEADER);
    expect(res.headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(res.headers['Content-Security-Policy']).toContain("script-src 'self'");
    expect(res.headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  });

  it('sets X-Content-Type-Options: nosniff', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets X-Frame-Options: DENY', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['X-Frame-Options']).toBe('DENY');
  });

  it('disables X-XSS-Protection (CSP is the control)', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['X-XSS-Protection']).toBe('0');
  });

  it('sets HSTS with 1-year max-age', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(res.headers['Strict-Transport-Security']).toContain('includeSubDomains');
  });

  it('sets strict referrer policy', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('sets Permissions-Policy restricting camera/microphone', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['Permissions-Policy']).toContain('camera=()');
    expect(res.headers['Permissions-Policy']).toContain('microphone=()');
    expect(res.headers['Permissions-Policy']).toContain('geolocation=(self)');
  });

  it('sets no-store cache control', () => {
    const res = mockRes();
    securityHeaders(mockReq(), res, vi.fn());
    expect(res.headers['Cache-Control']).toContain('no-store');
  });

  it('calls next()', () => {
    const next = vi.fn();
    securityHeaders(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('CSP allows OSM tiles for maps', () => {
    expect(CSP_HEADER).toContain('https://*.tile.openstreetmap.org');
  });

  it('CSP allows Stripe API for payments', () => {
    expect(CSP_HEADER).toContain('https://api.stripe.com');
  });
});
