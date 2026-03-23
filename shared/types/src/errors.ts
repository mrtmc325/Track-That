// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/** Canonical error catalogue shared across all services. */
export const ErrorCodes = {
  UNAUTHORIZED: {
    code: 'UNAUTHORIZED',
    message: 'Authentication is required to access this resource.',
    httpStatus: 401,
  },
  FORBIDDEN: {
    code: 'FORBIDDEN',
    message: 'You do not have permission to perform this action.',
    httpStatus: 403,
  },
  NOT_FOUND: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
    httpStatus: 404,
  },
  VALIDATION_ERROR: {
    code: 'VALIDATION_ERROR',
    message: 'The request payload failed validation.',
    httpStatus: 400,
  },
  RATE_LIMITED: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down.',
    httpStatus: 429,
  },
  INTERNAL_ERROR: {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected internal error occurred.',
    httpStatus: 500,
  },
  PRICE_CHANGED: {
    code: 'PRICE_CHANGED',
    message: 'The price of one or more items changed since the order was created.',
    httpStatus: 409,
  },
  PAYMENT_FAILED: {
    code: 'PAYMENT_FAILED',
    message: 'Payment processing failed.',
    httpStatus: 402,
  },
  DELIVERY_UNAVAILABLE: {
    code: 'DELIVERY_UNAVAILABLE',
    message: 'No delivery provider is available for the requested location.',
    httpStatus: 503,
  },
} as const;

/** Typed error class for application-level errors. Carries an HTTP status and optional details. */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;

    // Restore prototype chain when targeting ES5 downlevel compilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
