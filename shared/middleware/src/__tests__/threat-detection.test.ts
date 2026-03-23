import { describe, it, expect } from 'vitest';
import { detectThreats, isAllowedDomain, sanitizeForLog } from '../sanitize.js';

describe('Threat Detection (Phase 10 Section 10.8)', () => {
  describe('SQL Injection', () => {
    it('detects UNION SELECT', () => {
      expect(detectThreats('1 UNION SELECT * FROM users').threats).toContain('SQL_INJECTION');
    });
    it('detects DROP', () => {
      expect(detectThreats('; DROP TABLE products').threats).toContain('SQL_INJECTION');
    });
    it("detects OR '1'='1", () => {
      expect(detectThreats("' OR '1'='1").threats).toContain('SQL_INJECTION');
    });
    it('detects SQL comments', () => {
      expect(detectThreats('admin --').threats).toContain('SQL_INJECTION');
    });
  });

  describe('XSS', () => {
    it('detects script tags', () => {
      expect(detectThreats('<script>alert(1)</script>').threats).toContain('XSS');
    });
    it('detects javascript: protocol', () => {
      expect(detectThreats('javascript:void(0)').threats).toContain('XSS');
    });
    it('detects event handlers', () => {
      expect(detectThreats('onclick=alert(1)').threats).toContain('XSS');
    });
  });

  describe('Command Injection', () => {
    it('detects shell commands', () => {
      expect(detectThreats('; rm -rf /').threats).toContain('COMMAND_INJECTION');
    });
    it('detects $()', () => {
      expect(detectThreats('$(cat /etc/passwd)').threats).toContain('COMMAND_INJECTION');
    });
    it('detects backticks', () => {
      expect(detectThreats('`whoami`').threats).toContain('COMMAND_INJECTION');
    });
  });

  describe('Path Traversal', () => {
    it('detects ../', () => {
      expect(detectThreats('../../etc/passwd').threats).toContain('PATH_TRAVERSAL');
    });
    it('detects URL-encoded ../', () => {
      expect(detectThreats('%2e%2e/secret').threats).toContain('PATH_TRAVERSAL');
    });
  });

  describe('Safe inputs', () => {
    it('allows product names', () => {
      expect(detectThreats('Organic Apples 3lb').safe).toBe(true);
    });
    it('allows addresses', () => {
      expect(detectThreats('123 Main St, Phoenix, AZ').safe).toBe(true);
    });
    it('allows currency', () => {
      expect(detectThreats('$4.99 per pound').safe).toBe(true);
    });
  });

  it('strips HTML in sanitized output', () => {
    expect(detectThreats('<b>Bold</b>').sanitized).toBe('Bold');
  });

  it('detects multiple threats', () => {
    const result = detectThreats("<script>'; DROP TABLE --</script>");
    expect(result.threats.length).toBeGreaterThan(1);
  });
});

describe('SSRF Domain Allowlist', () => {
  const ALLOWED = ['store.example.com', 'api.vendor.com'];

  it('allows exact match', () => {
    expect(isAllowedDomain('https://store.example.com/products', ALLOWED)).toBe(true);
  });
  it('allows subdomain', () => {
    expect(isAllowedDomain('https://www.store.example.com', ALLOWED)).toBe(true);
  });
  it('rejects unlisted domain', () => {
    expect(isAllowedDomain('https://evil.com', ALLOWED)).toBe(false);
  });
  it('rejects HTTP', () => {
    expect(isAllowedDomain('http://store.example.com', ALLOWED)).toBe(false);
  });
  it('rejects malformed URL', () => {
    expect(isAllowedDomain('not-a-url', ALLOWED)).toBe(false);
  });
});

describe('sanitizeForLog', () => {
  it('removes control chars', () => {
    expect(sanitizeForLog('hello\x00world')).toBe('helloworld');
  });
  it('truncates to max length', () => {
    expect(sanitizeForLog('a'.repeat(1000), 100).length).toBe(100);
  });
});
