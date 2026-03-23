/**
 * Request body sanitization middleware
 * Per security.validate_all_untrusted_input and security.output_encoding_and_injection_prevention
 *
 * Mitigates R7: XSS via user-supplied content
 *
 * Strips HTML tags and dangerous patterns from string fields in request bodies.
 * This is a defense-in-depth layer on top of React's auto-escaping and CSP.
 */

import { Request, Response, NextFunction } from 'express';

const HTML_TAG_PATTERN = /<[^>]*>/g;
const SCRIPT_PATTERN = /javascript\s*:/gi;
const EVENT_HANDLER_PATTERN = /on\w+\s*=/gi;

export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = deepSanitize(req.body);
  }
  next();
}

function deepSanitize(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj
      .replace(HTML_TAG_PATTERN, '')
      .replace(SCRIPT_PATTERN, '')
      .replace(EVENT_HANDLER_PATTERN, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      cleaned[key] = deepSanitize(value);
    }
    return cleaned;
  }
  return obj;
}
