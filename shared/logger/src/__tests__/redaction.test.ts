// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { redactSensitiveFields } from '../redaction.js';

describe('redactSensitiveFields', () => {
  it('redacts known sensitive keys', () => {
    const input = {
      password: 'abc123',
      token: 'jwt-xyz',
      secret: 'shhh',
      authorization: 'Bearer xxx',
      cookie: 'session=abc',
      credit_card: '4111111111111111',
      card_number: '4111111111111111',
      cvv: '123',
      ssn: '123-45-6789',
      email: 'user@test.com',
    };
    const result = redactSensitiveFields(input);
    for (const key of Object.keys(result)) {
      expect(result[key]).toBe('[REDACTED]');
    }
  });

  it('preserves non-sensitive fields', () => {
    const input = { username: 'john', action: 'login', count: 5 };
    const result = redactSensitiveFields(input);
    expect(result).toEqual(input);
  });

  it('handles case-insensitive key matching', () => {
    const input = { PASSWORD: 'abc', AuthorizationHeader: 'xyz' };
    const result = redactSensitiveFields(input);
    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.AuthorizationHeader).toBe('[REDACTED]');
  });

  it('does not mutate the original object', () => {
    const input = { password: 'abc', name: 'test' };
    const result = redactSensitiveFields(input);
    expect(input.password).toBe('abc');
    expect(result.password).toBe('[REDACTED]');
  });

  it('handles empty objects', () => {
    expect(redactSensitiveFields({})).toEqual({});
  });

  it('redacts nested sensitive fields (deep traversal)', () => {
    const input = {
      user: { password: 'secret', name: 'John' },
      payment: { card_number: '4242', amount: 10 },
    };
    const result = redactSensitiveFields(input);
    expect((result.user as any).password).toBe('[REDACTED]');
    expect((result.user as any).name).toBe('John');
    expect((result.payment as any).card_number).toBe('[REDACTED]');
    expect((result.payment as any).amount).toBe(10);
  });

  it('redacts fields with sensitive substrings', () => {
    const result = redactSensitiveFields({
      user_password_hash: 'bcrypt$...',
      refresh_token_id: 'uuid',
      api_secret_key: 'abc',
    });
    expect(result.user_password_hash).toBe('[REDACTED]');
    expect(result.refresh_token_id).toBe('[REDACTED]');
    expect(result.api_secret_key).toBe('[REDACTED]');
  });
});
