// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Retry with exponential backoff and jitter
 * Per reliability.timeouts_retries_and_circuit_breakers
 *
 * Mitigates R3: Payment processing failures during multi-store checkout
 * Uses bounded retries with jitter to prevent thundering herd on Stripe API
 */

export interface RetryOptions {
  maxRetries: number;          // default: 3
  baseDelayMs: number;         // default: 1000
  maxDelayMs: number;          // default: 10000
  jitterFactor: number;        // 0-1, default: 0.2
  retryableErrors?: (error: unknown) => boolean; // predicate for retryable errors
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.2,
};

/** Calculate delay: min(baseDelay * 2^attempt, maxDelay) + random jitter */
export function calculateDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number,
  jitterFactor: number,
): number {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  const jitter = capped * jitterFactor * (Math.random() * 2 - 1); // [-jitterFactor*delay, +jitterFactor*delay]
  return Math.max(0, capped + jitter);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // If a retryability predicate is provided and it returns false, stop immediately
      if (opts.retryableErrors && !opts.retryableErrors(error)) {
        throw error;
      }

      // If this was the last attempt, throw
      if (attempt === opts.maxRetries) {
        break;
      }

      const delay = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs, opts.jitterFactor);
      await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
