import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker } from '../circuit-breaker.js';
import type { CircuitState } from '../circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });

  it('stays CLOSED when failure count is below threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
    const failing = vi.fn().mockRejectedValue(new Error('fail'));

    // 2 failures — below threshold of 3
    for (let i = 0; i < 2; i++) {
      await expect(cb.execute(failing)).rejects.toThrow('fail');
    }

    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(2);
  });

  it('transitions to OPEN after threshold failures within window', async () => {
    const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      name: 'doordash',
      failureThreshold: 3,
      onStateChange: (_name, from, to) => stateChanges.push({ from, to }),
    });
    const failing = vi.fn().mockRejectedValue(new Error('provider down'));

    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(failing)).rejects.toThrow('provider down');
    }

    expect(cb.getState()).toBe('OPEN');
    expect(stateChanges).toEqual([{ from: 'CLOSED', to: 'OPEN' }]);
  });

  it('rejects immediately with error when OPEN and no fallback is provided', async () => {
    const cb = new CircuitBreaker({ name: 'redis', failureThreshold: 1, resetTimeoutMs: 30000 });
    const failing = vi.fn().mockRejectedValue(new Error('redis error'));

    // Trip the breaker
    await expect(cb.execute(failing)).rejects.toThrow('redis error');
    expect(cb.getState()).toBe('OPEN');

    // Next call should fast-fail without invoking fn
    const probe = vi.fn().mockResolvedValue('ok');
    await expect(cb.execute(probe)).rejects.toThrow("Circuit breaker 'redis' is OPEN");
    expect(probe).not.toHaveBeenCalled();
  });

  it('uses fallback when circuit is OPEN', async () => {
    const cb = new CircuitBreaker({ name: 'redis', failureThreshold: 1, resetTimeoutMs: 30000 });
    const failing = vi.fn().mockRejectedValue(new Error('redis error'));
    const fallback = vi.fn().mockResolvedValue('db-result');

    // Trip the breaker
    await expect(cb.execute(failing)).rejects.toThrow('redis error');
    expect(cb.getState()).toBe('OPEN');

    // Next call uses fallback
    const result = await cb.execute(vi.fn(), fallback);
    expect(result).toBe('db-result');
    expect(fallback).toHaveBeenCalledOnce();
  });

  it('transitions to HALF_OPEN after resetTimeout elapses', async () => {
    const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      name: 'doordash',
      failureThreshold: 1,
      resetTimeoutMs: 30000,
      onStateChange: (_name, from, to) => stateChanges.push({ from, to }),
    });
    const failing = vi.fn().mockRejectedValue(new Error('fail'));

    // Trip to OPEN
    await expect(cb.execute(failing)).rejects.toThrow('fail');
    expect(cb.getState()).toBe('OPEN');

    // Advance time past resetTimeout
    vi.advanceTimersByTime(30001);

    // Next execute should probe (transition to HALF_OPEN then attempt)
    const succeeding = vi.fn().mockResolvedValue('ok');
    await cb.execute(succeeding);

    expect(stateChanges).toContainEqual({ from: 'OPEN', to: 'HALF_OPEN' });
  });

  it('returns to CLOSED on successful probe in HALF_OPEN', async () => {
    const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      name: 'doordash',
      failureThreshold: 1,
      resetTimeoutMs: 30000,
      onStateChange: (_name, from, to) => stateChanges.push({ from, to }),
    });

    // Trip to OPEN
    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow();
    vi.advanceTimersByTime(30001);

    // Successful probe
    const result = await cb.execute(vi.fn().mockResolvedValue('recovered'));
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
    expect(stateChanges).toContainEqual({ from: 'HALF_OPEN', to: 'CLOSED' });
  });

  it('returns to OPEN on failed probe in HALF_OPEN', async () => {
    const stateChanges: Array<{ from: CircuitState; to: CircuitState }> = [];
    const cb = new CircuitBreaker({
      name: 'doordash',
      failureThreshold: 1,
      resetTimeoutMs: 30000,
      onStateChange: (_name, from, to) => stateChanges.push({ from, to }),
    });

    // Trip to OPEN
    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow();
    vi.advanceTimersByTime(30001);

    // Failed probe — no fallback so it throws, and breaker returns to OPEN
    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('still down')))).rejects.toThrow('still down');
    expect(cb.getState()).toBe('OPEN');
    expect(stateChanges).toContainEqual({ from: 'HALF_OPEN', to: 'OPEN' });
  });

  it('calls onStateChange callback with correct name and states on every transition', async () => {
    const onStateChange = vi.fn();
    const cb = new CircuitBreaker({
      name: 'stripe',
      failureThreshold: 2,
      resetTimeoutMs: 5000,
      onStateChange,
    });
    const failing = vi.fn().mockRejectedValue(new Error('stripe down'));

    await expect(cb.execute(failing)).rejects.toThrow();
    await expect(cb.execute(failing)).rejects.toThrow(); // → OPEN

    vi.advanceTimersByTime(5001);
    await cb.execute(vi.fn().mockResolvedValue('ok')); // → HALF_OPEN → CLOSED

    expect(onStateChange).toHaveBeenCalledWith('stripe', 'CLOSED', 'OPEN');
    expect(onStateChange).toHaveBeenCalledWith('stripe', 'OPEN', 'HALF_OPEN');
    expect(onStateChange).toHaveBeenCalledWith('stripe', 'HALF_OPEN', 'CLOSED');
  });

  it('prunes old failures outside monitoring window so they do not count toward threshold', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 3,
      monitorWindowMs: 10000,
      resetTimeoutMs: 30000,
    });
    const failing = vi.fn().mockRejectedValue(new Error('fail'));

    // 2 failures
    await expect(cb.execute(failing)).rejects.toThrow();
    await expect(cb.execute(failing)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');

    // Advance past monitor window so those failures expire
    vi.advanceTimersByTime(10001);

    // 2 more failures — should still be CLOSED because old ones pruned
    await expect(cb.execute(failing)).rejects.toThrow();
    await expect(cb.execute(failing)).rejects.toThrow();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(2);
  });

  it('clears failure history when transitioning from HALF_OPEN to CLOSED', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      resetTimeoutMs: 5000,
    });

    // Build up failures and trip breaker
    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow();
    await expect(cb.execute(vi.fn().mockRejectedValue(new Error('fail')))).rejects.toThrow();
    expect(cb.getState()).toBe('OPEN');

    vi.advanceTimersByTime(5001);

    // Successful probe — clears failures
    await cb.execute(vi.fn().mockResolvedValue('ok'));
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getFailureCount()).toBe(0);
  });
});
