// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Circuit breaker pattern per reliability.timeouts_retries_and_circuit_breakers
 *
 * Mitigates:
 * - R4: Delivery provider API outages — isolates failing providers
 * - R9: Redis failure — falls back to direct DB queries
 *
 * States: CLOSED (normal) → OPEN (failing, reject fast) → HALF_OPEN (probe)
 * Transitions:
 *   CLOSED → OPEN: when failure count >= threshold within window
 *   OPEN → HALF_OPEN: after resetTimeout elapses
 *   HALF_OPEN → CLOSED: on successful probe
 *   HALF_OPEN → OPEN: on failed probe
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;                    // e.g., 'doordash', 'redis'
  failureThreshold?: number;       // failures before opening (default: 5)
  resetTimeoutMs?: number;         // time before half-open probe (default: 30000)
  monitorWindowMs?: number;        // window for counting failures (default: 60000)
  onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failures: number[] = []; // timestamps of failures
  private lastFailureTime = 0;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly monitorWindowMs: number;
  private readonly onStateChange?: (name: string, from: CircuitState, to: CircuitState) => void;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30000;
    this.monitorWindowMs = options.monitorWindowMs ?? 60000;
    this.onStateChange = options.onStateChange;
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeoutMs) {
        this.transition('HALF_OPEN');
      } else {
        if (fallback) return fallback();
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.transition('CLOSED');
        this.failures = [];
      }
      return result;
    } catch (error) {
      this.recordFailure();
      if (this.state === 'HALF_OPEN') {
        this.transition('OPEN');
      }
      if (fallback) return fallback();
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    const now = Date.now();
    return this.failures.filter(t => now - t < this.monitorWindowMs).length;
  }

  private recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;
    // Prune old failures outside window
    this.failures = this.failures.filter(t => now - t < this.monitorWindowMs);
    if (this.state === 'CLOSED' && this.failures.length >= this.failureThreshold) {
      this.transition('OPEN');
    }
  }

  private transition(to: CircuitState): void {
    const from = this.state;
    this.state = to;
    this.onStateChange?.(this.name, from, to);
  }
}
