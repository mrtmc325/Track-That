// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, beforeEach } from 'vitest';
import { verifyWebhookSignature, computeHmac, _resetProcessedEvents } from '../hmac.js';

describe('HMAC Webhook Verification', () => {
  beforeEach(() => { _resetProcessedEvents(); });

  const BODY = '{"event":"driver_assigned","delivery_id":"del-1"}';
  const PROVIDER = 'doordash';

  it('accepts valid HMAC signature', () => {
    const sig = computeHmac(PROVIDER, BODY);
    const result = verifyWebhookSignature(PROVIDER, sig, BODY);
    expect(result.valid).toBe(true);
  });

  it('rejects invalid signature', () => {
    const result = verifyWebhookSignature(PROVIDER, 'deadbeef'.repeat(8), BODY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid signature');
  });

  it('rejects unknown provider', () => {
    const result = verifyWebhookSignature('unknown_provider', 'abc', BODY);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Unknown provider');
  });

  it('rejects expired timestamp (> 5 minutes)', () => {
    const sig = computeHmac(PROVIDER, BODY);
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString(); // 6 min ago
    const result = verifyWebhookSignature(PROVIDER, sig, BODY, oldTimestamp);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('window');
  });

  it('accepts timestamp within 5-minute window', () => {
    const sig = computeHmac(PROVIDER, BODY);
    const recentTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 min ago
    const result = verifyWebhookSignature(PROVIDER, sig, BODY, recentTimestamp);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate event ID (replay protection)', () => {
    const sig = computeHmac(PROVIDER, BODY);
    verifyWebhookSignature(PROVIDER, sig, BODY, undefined, 'evt-1');
    const result = verifyWebhookSignature(PROVIDER, sig, BODY, undefined, 'evt-1');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
  });

  it('accepts different event IDs', () => {
    const sig = computeHmac(PROVIDER, BODY);
    const r1 = verifyWebhookSignature(PROVIDER, sig, BODY, undefined, 'evt-1');
    const r2 = verifyWebhookSignature(PROVIDER, sig, BODY, undefined, 'evt-2');
    expect(r1.valid).toBe(true);
    expect(r2.valid).toBe(true);
  });

  it('rejects invalid timestamp format', () => {
    const sig = computeHmac(PROVIDER, BODY);
    const result = verifyWebhookSignature(PROVIDER, sig, BODY, 'not-a-date');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid timestamp');
  });

  it('works with uber provider', () => {
    const body = '{"test":true}';
    const sig = computeHmac('uber', body);
    const result = verifyWebhookSignature('uber', sig, body);
    expect(result.valid).toBe(true);
  });
});
