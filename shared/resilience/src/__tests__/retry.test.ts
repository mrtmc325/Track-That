// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, calculateDelay } from '../retry.js';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns result on first success without any retries', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const promise = retryWithBackoff(fn, { maxRetries: 3, jitterFactor: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('success');

    const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 100, jitterFactor: 0 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws the last error after exhausting all retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

    const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 100, jitterFactor: 0 });
    const assertion = expect(promise).rejects.toThrow('persistent failure');
    await vi.runAllTimersAsync();

    await assertion;
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('does not retry when retryableErrors predicate returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('non-retryable'));
    const retryableErrors = vi.fn().mockReturnValue(false);

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      jitterFactor: 0,
      retryableErrors,
    });
    const assertion = expect(promise).rejects.toThrow('non-retryable');
    await vi.runAllTimersAsync();

    await assertion;
    expect(fn).toHaveBeenCalledOnce(); // stopped immediately
    expect(retryableErrors).toHaveBeenCalledOnce();
  });

  it('retries when retryableErrors predicate returns true', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('stripe timeout'))
      .mockResolvedValue('charged');
    const retryableErrors = vi.fn().mockReturnValue(true);

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 100,
      jitterFactor: 0,
      retryableErrors,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('charged');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('applies increasing exponential backoff delays between retries', async () => {
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    const setTimeoutSpy = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
        if (typeof delay === 'number' && delay > 0) delays.push(delay);
        return originalSetTimeout(fn as () => void, 0, ...args);
      });

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const promise = retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
      jitterFactor: 0,
    });
    await vi.runAllTimersAsync();
    await promise;

    setTimeoutSpy.mockRestore();

    // With jitterFactor=0: attempt 0 → 1000ms, attempt 1 → 2000ms
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
  });
});

describe('calculateDelay', () => {
  it('returns baseDelay * 2^attempt capped at maxDelay (no jitter)', () => {
    // jitterFactor=0 means jitter term is 0
    expect(calculateDelay(0, 1000, 10000, 0)).toBe(1000);
    expect(calculateDelay(1, 1000, 10000, 0)).toBe(2000);
    expect(calculateDelay(2, 1000, 10000, 0)).toBe(4000);
    expect(calculateDelay(3, 1000, 10000, 0)).toBe(8000);
    expect(calculateDelay(4, 1000, 10000, 0)).toBe(10000); // capped
    expect(calculateDelay(10, 1000, 10000, 0)).toBe(10000); // still capped
  });

  it('keeps jitter within ±jitterFactor * cappedDelay bounds', () => {
    const base = 1000;
    const max = 10000;
    const jitter = 0.2;

    for (let attempt = 0; attempt < 5; attempt++) {
      const cappedDelay = Math.min(base * Math.pow(2, attempt), max);
      const lowerBound = cappedDelay * (1 - jitter);
      const upperBound = cappedDelay * (1 + jitter);

      for (let trial = 0; trial < 20; trial++) {
        const delay = calculateDelay(attempt, base, max, jitter);
        expect(delay).toBeGreaterThanOrEqual(lowerBound);
        expect(delay).toBeLessThanOrEqual(upperBound);
      }
    }
  });
});
