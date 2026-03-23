// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Input Sanitization Utilities
 * Per Phase 10 spec section 10.8:
 * Defends against SQL injection, XSS, command injection, path traversal, and SSRF.
 *
 * security.validate_all_untrusted_input — all external input treated as untrusted
 * security.output_encoding_and_injection_prevention — prevent injection attacks
 */

/** SQL injection patterns to detect */
const SQL_INJECTION_PATTERNS = [
  /union\s+select/i,
  /;\s*drop\s+/i,
  /;\s*delete\s+/i,
  /;\s*update\s+.*set\s/i,
  /'\s*or\s+['1]/i,
  /'\s*and\s+['1]/i,
  /--\s*$/,
  /\/\*[\s\S]*?\*\//,
  /\bexec\s*\(/i,
  /\bchar\s*\(\s*\d/i,
  /\bconvert\s*\(/i,
];

/** XSS patterns to detect */
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /on\w+\s*=/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*javascript/i,
  /data\s*:\s*text\/html/i,
  /vbscript\s*:/i,
];

/** Command injection patterns */
const CMD_INJECTION_PATTERNS = [
  /[;&|`$]\s*(?:cat|ls|rm|mv|cp|chmod|chown|curl|wget|nc|bash|sh|python|node|perl)\b/i,
  /\$\(.*\)/,
  /`[^`]*`/,
];

/** Path traversal patterns */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e[\/\\]/i,
  /%252e%252e/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
];

export interface SanitizationResult {
  safe: boolean;
  threats: string[];
  sanitized: string;
}

/**
 * Check a string for known injection/attack patterns.
 * Returns whether the input is safe and which threats were detected.
 */
export function detectThreats(input: string): SanitizationResult {
  const threats: string[] = [];
  let sanitized = input;

  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) threats.push('SQL_INJECTION');
  }
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) threats.push('XSS');
  }
  for (const pattern of CMD_INJECTION_PATTERNS) {
    if (pattern.test(input)) threats.push('COMMAND_INJECTION');
  }
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) threats.push('PATH_TRAVERSAL');
  }

  // Deduplicate threat types
  const uniqueThreats = [...new Set(threats)];

  // Sanitize: strip HTML tags, null bytes
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/\0/g, '');

  return {
    safe: uniqueThreats.length === 0,
    threats: uniqueThreats,
    sanitized,
  };
}

/**
 * Validate a URL against an allowlist of domains.
 * Prevents SSRF by ensuring only pre-approved domains are accessed.
 * Per T7 mitigation: allowlist domains for scraping.
 */
export function isAllowedDomain(url: string, allowedDomains: string[]): boolean {
  try {
    const parsed = new URL(url);
    // Require HTTPS per security.encryption_in_transit_and_at_rest
    if (parsed.protocol !== 'https:') return false;
    return allowedDomains.some(domain =>
      parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false; // Malformed URL
  }
}

/**
 * Sanitize a file path — reject path traversal attempts.
 * Only allows paths within an explicit base directory.
 */
export function sanitizePath(inputPath: string, allowedBase: string): string | null {
  // Reject obvious traversal
  if (PATH_TRAVERSAL_PATTERNS.some(p => p.test(inputPath))) {
    return null;
  }

  // Normalize and check it stays within base
  const path = require('node:path');
  const resolved = path.resolve(allowedBase, inputPath);
  if (!resolved.startsWith(path.resolve(allowedBase))) {
    return null;
  }

  return resolved;
}

/**
 * Strip HTML tags from a string for safe text display.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitize text for safe log output.
 * Removes control characters and limits length.
 * Per security.no_sensitive_data_in_logs.
 */
export function sanitizeForLog(input: string, maxLength: number = 500): string {
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Strip control chars
    .substring(0, maxLength)
    .trim();
}

/**
 * Express middleware: sanitize all string fields in req.body.
 * Strips HTML tags and javascript: patterns from user input.
 * Backward compatible with Sprint 3 middleware contract.
 */
export function sanitizeBody(req: any, _res: any, next: () => void): void {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

function deepSanitize(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/<[^>]*>/g, '')          // Strip HTML tags
      .replace(/javascript\s*:/gi, '')   // Strip javascript: protocol
      .replace(/on\w+\s*=/gi, '');       // Strip event handlers
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item));
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepSanitize(value);
    }
    return result;
  }
  return obj;
}
