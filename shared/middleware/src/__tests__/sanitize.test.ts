import { describe, it, expect, vi } from 'vitest';
import { sanitizeBody } from '../sanitize.js';

function mockReq(overrides = {}) {
  return { method: 'POST', cookies: {}, headers: {}, body: {}, ...overrides } as any;
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

describe('sanitizeBody', () => {
  it('strips HTML tags from string fields', () => {
    const req = mockReq({ body: { name: '<script>alert(1)</script>hello' } });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.name).toBe('alert(1)hello');
    expect(next).toHaveBeenCalledOnce();
  });

  it('removes javascript: patterns', () => {
    const req = mockReq({ body: { url: 'javascript:alert(1)' } });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.url).toBe('alert(1)');
    expect(next).toHaveBeenCalledOnce();
  });

  it('removes event handler attributes (onclick= etc)', () => {
    const req = mockReq({ body: { content: 'click here onclick=doEvil()' } });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.content).toBe('click here doEvil()');
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes through non-string values unchanged', () => {
    const req = mockReq({ body: { count: 42, active: true, nothing: null } });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.count).toBe(42);
    expect(req.body.active).toBe(true);
    expect(req.body.nothing).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sanitizes nested objects recursively', () => {
    const req = mockReq({
      body: {
        user: {
          bio: '<b>Hello</b>',
          meta: { note: '<em>test</em>' },
        },
      },
    });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.user.bio).toBe('Hello');
    expect(req.body.user.meta.note).toBe('test');
    expect(next).toHaveBeenCalledOnce();
  });

  it('sanitizes strings inside arrays', () => {
    const req = mockReq({ body: { tags: ['<b>sale</b>', 'normal', '<i>new</i>'] } });
    const res = mockRes();
    const next = vi.fn();

    sanitizeBody(req, res, next);

    expect(req.body.tags).toEqual(['sale', 'normal', 'new']);
    expect(next).toHaveBeenCalledOnce();
  });
});
