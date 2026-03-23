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
});
