// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Security Headers Middleware
 * Per Phase 10 spec section 10.3:
 * Sets all required security headers on every response.
 *
 * CSP is the primary XSS control (X-XSS-Protection set to 0 per spec).
 * Frame-ancestors 'none' prevents clickjacking.
 * HSTS enforces HTTPS with 1-year max-age.
 *
 * security.output_encoding_and_injection_prevention — CSP prevents inline script execution
 * security.encryption_in_transit_and_at_rest — HSTS enforces TLS
 */
import type { Request, Response, NextFunction } from 'express';

/**
 * Content Security Policy per spec.
 * - default-src 'self': only load resources from same origin
 * - script-src 'self': no inline scripts, no eval
 * - style-src 'self' 'unsafe-inline': Tailwind needs inline styles
 * - img-src: allow OSM tiles and data URIs
 * - connect-src: allow Stripe API for payment
 * - frame-ancestors 'none': prevent embedding (clickjacking protection)
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.tile.openstreetmap.org",
  "connect-src 'self' https://api.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/**
 * Permissions Policy per spec.
 * Only geolocation allowed (for store proximity); camera/microphone blocked.
 */
const PERMISSIONS_POLICY = 'geolocation=(self), camera=(), microphone=(), payment=()';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Content Security Policy — primary XSS defense
  res.setHeader('Content-Security-Policy', CSP);

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent framing (clickjacking) — redundant with CSP frame-ancestors but defense-in-depth
  res.setHeader('X-Frame-Options', 'DENY');

  // Disable browser XSS filter — CSP is the control per spec
  res.setHeader('X-XSS-Protection', '0');

  // Enforce HTTPS for 1 year with subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Control referrer information leakage
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Restrict browser features
  res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);

  // Prevent caching of sensitive responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  next();
}

/** Export CSP string for testing */
export const CSP_HEADER = CSP;
export const PERMISSIONS_POLICY_HEADER = PERMISSIONS_POLICY;
