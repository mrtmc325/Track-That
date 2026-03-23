// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLogger } from '../index.js';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('emits JSON to stdout with correct severity levels', () => {
    const logger = createLogger('test-service');
    logger.info('test.action', 'Hello world');

    expect(consoleSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.severity).toBe(6); // INFORMATIONAL
    expect(output.service).toBe('test-service');
    expect(output.action).toBe('test.action');
    expect(output.message).toBe('Hello world');
    expect(output.timestamp).toBeDefined();
    expect(output.request_id).toBe('none');
  });

  it('maps all severity levels to syslog 0-7', () => {
    const logger = createLogger('test-service');
    const methods: [keyof typeof logger, number][] = [
      ['emergency', 0], ['alert', 1], ['critical', 2], ['error', 3],
      ['warning', 4], ['notice', 5], ['info', 6], ['debug', 7],
    ];
    for (const [method, expected] of methods) {
      consoleSpy.mockClear();
      logger[method]('test', 'msg');
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.severity).toBe(expected);
    }
  });

  it('includes request_id and user_id from metadata', () => {
    const logger = createLogger('auth-service');
    logger.notice('auth.login', 'User logged in', {
      request_id: 'req-123',
      user_id: 'usr-456',
    });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.request_id).toBe('req-123');
    expect(output.user_id).toBe('usr-456');
  });

  it('redacts sensitive fields from metadata', () => {
    const logger = createLogger('auth-service');
    logger.info('auth.attempt', 'Login attempt', {
      request_id: 'req-1',
      password: 'secret123',
      email: 'user@example.com',
      token: 'jwt-abc',
      username: 'john',
    });

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.metadata.password).toBe('[REDACTED]');
    expect(output.metadata.email).toBe('[REDACTED]');
    expect(output.metadata.token).toBe('[REDACTED]');
    expect(output.metadata.username).toBe('john'); // not sensitive
  });

  it('does not include metadata key when no metadata provided', () => {
    const logger = createLogger('test');
    logger.info('test.action', 'No meta');

    const output = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(output.metadata).toBeUndefined();
  });
});
