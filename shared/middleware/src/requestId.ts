// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// Every request receives a unique ID so that all log lines produced during
// that request can be correlated across services.
// Reference: observability.observability_by_default
import type { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that ensures every inbound request carries a unique
 * request identifier.
 *
 * If the caller already supplied an `x-request-id` header (e.g. an upstream
 * proxy or another service) that value is reused so the ID is propagated
 * end-to-end. Otherwise a UUID v4 is generated via the built-in
 * `crypto.randomUUID()` — no external dependency required.
 *
 * The resolved ID is:
 *   - Written to `req.requestId` for use in structured log metadata.
 *   - Echoed back to the caller as the `X-Request-ID` response header.
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incomingId = req.headers['x-request-id'];
  const id =
    typeof incomingId === 'string' && incomingId.length > 0
      ? incomingId
      : crypto.randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
