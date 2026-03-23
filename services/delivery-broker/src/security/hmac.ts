// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * HMAC webhook signature verification.
 * Per Phase 8 spec section 8.7:
 * - Validates HMAC-SHA256 signature
 * - 5-minute replay protection via timestamp
 * - Idempotency via event ID deduplication
 *
 * security.validate_all_untrusted_input — webhook payloads are untrusted
 * security.auditability_for_privileged_actions — all webhook events logged
 */
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

// Per-provider webhook secrets (from env in production)
const providerSecrets: Record<string, string> = {
  doordash: process.env.DOORDASH_WEBHOOK_SECRET || 'dev-doordash-secret-key-minimum-32chars!',
  uber: process.env.UBER_WEBHOOK_SECRET || 'dev-uber-secret-key-minimum-32chars!!!',
};

/** Maximum age for webhook timestamps (5 minutes) */
const MAX_AGE_MS = 5 * 60 * 1000;

// Processed event IDs for replay protection (in production: Redis SET with TTL)
const processedEvents = new Set<string>();

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify HMAC-SHA256 signature on an inbound webhook.
 * @param provider - Provider name (doordash, uber)
 * @param signature - X-Signature header value
 * @param body - Raw request body string
 * @param timestamp - Timestamp from payload (ISO 8601)
 * @param eventId - Unique event identifier for replay protection
 */
export function verifyWebhookSignature(
  provider: string,
  signature: string,
  body: string,
  timestamp?: string,
  eventId?: string,
): WebhookVerificationResult {
  // 1. Check provider secret exists
  const secret = providerSecrets[provider];
  if (!secret) {
    logger.warning('webhook.unknown_provider', 'Webhook from unknown provider', { provider });
    return { valid: false, error: 'Unknown provider' };
  }

  // 2. Replay protection: check timestamp freshness (5-minute window)
  if (timestamp) {
    const eventTime = new Date(timestamp).getTime();
    if (isNaN(eventTime)) {
      return { valid: false, error: 'Invalid timestamp' };
    }
    const age = Math.abs(Date.now() - eventTime);
    if (age > MAX_AGE_MS) {
      logger.warning('webhook.replay_rejected', 'Webhook timestamp outside 5-minute window', {
        provider,
        age_ms: age,
      });
      return { valid: false, error: 'Timestamp outside acceptable window' };
    }
  }

  // 3. Replay protection: check event ID uniqueness
  if (eventId) {
    if (processedEvents.has(eventId)) {
      logger.debug('webhook.duplicate', 'Duplicate event ID', { provider, event_id: eventId });
      return { valid: false, error: 'Duplicate event' };
    }
  }

  // 4. HMAC-SHA256 signature verification
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    logger.warning('webhook.signature_mismatch', 'HMAC signature verification failed', { provider });
    return { valid: false, error: 'Invalid signature' };
  }

  // 5. Mark event as processed
  if (eventId) {
    processedEvents.add(eventId);
    // In production: SET with 10-minute TTL in Redis
  }

  logger.info('webhook.verified', 'Webhook signature verified', { provider, event_id: eventId });
  return { valid: true };
}

/** Compute HMAC for testing */
export function computeHmac(provider: string, body: string): string {
  const secret = providerSecrets[provider] || 'test-secret';
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/** Clear processed events (testing) */
export function _resetProcessedEvents(): void {
  processedEvents.clear();
}

/** Set a provider secret (testing) */
export function _setProviderSecret(provider: string, secret: string): void {
  providerSecrets[provider] = secret;
}
