// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withFallback, withTimeout } from '../fallback.js';

describe('withFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the primary result when primary succeeds', async () => {
    const primary = vi.fn().mockResolvedValue('elasticsearch-result');
    const secondary = vi.fn().mockResolvedValue('postgres-result');

    const promise = withFallback(primary, secondary, { name: 'search', timeoutMs: 5000 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('elasticsearch-result');
    expect(secondary).not.toHaveBeenCalled();
  });

  it('returns the secondary result when primary throws', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('ES down'));
    const secondary = vi.fn().mockResolvedValue('postgres-result');

    const promise = withFallback(primary, secondary, { name: 'search' });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('postgres-result');
    expect(secondary).toHaveBeenCalledOnce();
  });

  it('calls onFallback callback with name and error when falling back', async () => {
    const esError = new Error('ES connection refused');
    const primary = vi.fn().mockRejectedValue(esError);
    const secondary = vi.fn().mockResolvedValue('postgres-result');
    const onFallback = vi.fn();

    const promise = withFallback(primary, secondary, {
      name: 'restaurant-search',
      onFallback,
    });
    await vi.runAllTimersAsync();
    await promise;

    expect(onFallback).toHaveBeenCalledOnce();
    expect(onFallback).toHaveBeenCalledWith('restaurant-search', esError);
  });

  it('times out the primary and falls back to secondary', async () => {
    // Primary never resolves
    const primary = vi.fn().mockReturnValue(new Promise(() => {}));
    const secondary = vi.fn().mockResolvedValue('redis-fallback');
    const onFallback = vi.fn();

    const promise = withFallback(primary, secondary, {
      name: 'cache',
      timeoutMs: 500,
      onFallback,
    });

    vi.advanceTimersByTime(501);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('redis-fallback');
    expect(onFallback).toHaveBeenCalledOnce();
    const [, err] = onFallback.mock.calls[0] as [string, Error];
    expect(err.message).toMatch(/timed out/i);
  });

  it('throws when both primary and secondary fail', async () => {
    const primary = vi.fn().mockRejectedValue(new Error('ES down'));
    const secondary = vi.fn().mockRejectedValue(new Error('Postgres down'));

    const promise = withFallback(primary, secondary, { name: 'search' });
    const assertion = expect(promise).rejects.toThrow('Postgres down');
    await vi.runAllTimersAsync();

    await assertion;
  });
});

describe('withTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when the promise completes before the timeout', async () => {
    const inner = Promise.resolve('fast');
    const promise = withTimeout(inner, 1000);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('fast');
  });

  it('rejects with a timeout error when the promise exceeds timeoutMs', async () => {
    const inner = new Promise(() => {}); // never resolves
    const promise = withTimeout(inner, 200);
    const assertion = expect(promise).rejects.toThrow('timed out after 200ms');

    vi.advanceTimersByTime(201);
    await vi.runAllTimersAsync();

    await assertion;
  });
});
