// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { AppError, ErrorCodes } from '../errors.js';

describe('AppError', () => {
  it('creates an error with code and httpStatus', () => {
    const err = new AppError('TEST_ERROR', 'Test message', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TEST_ERROR');
    expect(err.httpStatus).toBe(400);
    expect(err.message).toBe('Test message');
  });

  it('includes optional details', () => {
    const details = { field: 'email', reason: 'invalid' };
    const err = new AppError('VALIDATION_ERROR', 'Bad input', 400, details);
    expect(err.details).toEqual(details);
  });

  it('has a proper stack trace', () => {
    const err = new AppError('TEST', 'msg', 500);
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('AppError');
  });
});

describe('ErrorCodes', () => {
  it('defines all required error codes', () => {
    const required = [
      'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION_ERROR',
      'RATE_LIMITED', 'INTERNAL_ERROR', 'PRICE_CHANGED',
      'PAYMENT_FAILED', 'DELIVERY_UNAVAILABLE',
    ];
    for (const code of required) {
      expect(ErrorCodes[code]).toBeDefined();
      expect(ErrorCodes[code].code).toBe(code);
      expect(typeof ErrorCodes[code].httpStatus).toBe('number');
      expect(typeof ErrorCodes[code].message).toBe('string');
    }
  });

  it('maps correct HTTP status codes', () => {
    expect(ErrorCodes.UNAUTHORIZED.httpStatus).toBe(401);
    expect(ErrorCodes.FORBIDDEN.httpStatus).toBe(403);
    expect(ErrorCodes.NOT_FOUND.httpStatus).toBe(404);
    expect(ErrorCodes.VALIDATION_ERROR.httpStatus).toBe(400);
    expect(ErrorCodes.RATE_LIMITED.httpStatus).toBe(429);
    expect(ErrorCodes.INTERNAL_ERROR.httpStatus).toBe(500);
    expect(ErrorCodes.PRICE_CHANGED.httpStatus).toBe(409);
    expect(ErrorCodes.PAYMENT_FAILED.httpStatus).toBe(402);
    expect(ErrorCodes.DELIVERY_UNAVAILABLE.httpStatus).toBe(503);
  });
});
