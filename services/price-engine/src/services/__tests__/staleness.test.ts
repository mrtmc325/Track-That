import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyFreshness, freshnessScore, shouldIncludeInResults, FRESHNESS_THRESHOLDS } from '../staleness.service.js';

describe('Price Staleness (R6 mitigation)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('classifyFreshness', () => {
    it('returns FRESH for prices scraped < 4 hours ago', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      expect(classifyFreshness(twoHoursAgo)).toBe('FRESH');
    });

    it('returns AGING for prices scraped 4-24 hours ago', () => {
      const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);
      expect(classifyFreshness(tenHoursAgo)).toBe('AGING');
    });

    it('returns STALE for prices scraped 24-72 hours ago', () => {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      expect(classifyFreshness(fortyEightHoursAgo)).toBe('STALE');
    });

    it('returns EXPIRED for prices scraped > 72 hours ago', () => {
      const fourDaysAgo = new Date(Date.now() - 96 * 60 * 60 * 1000);
      expect(classifyFreshness(fourDaysAgo)).toBe('EXPIRED');
    });

    it('returns FRESH at boundary (just under 4 hours)', () => {
      const justUnder = new Date(Date.now() - (FRESHNESS_THRESHOLDS.FRESH_MAX_HOURS * 60 * 60 * 1000 - 1));
      expect(classifyFreshness(justUnder)).toBe('FRESH');
    });
  });

  describe('freshnessScore', () => {
    it('returns 1.0 for just-scraped prices', () => {
      expect(freshnessScore(new Date())).toBeCloseTo(1.0, 1);
    });

    it('returns ~0.5 for prices scraped 36 hours ago', () => {
      const thirySixHours = new Date(Date.now() - 36 * 60 * 60 * 1000);
      expect(freshnessScore(thirySixHours)).toBeCloseTo(0.5, 1);
    });

    it('returns 0 for prices scraped >= 72 hours ago', () => {
      const seventyTwoHours = new Date(Date.now() - 72 * 60 * 60 * 1000);
      expect(freshnessScore(seventyTwoHours)).toBe(0);
    });

    it('never returns negative', () => {
      const longAgo = new Date(Date.now() - 200 * 60 * 60 * 1000);
      expect(freshnessScore(longAgo)).toBe(0);
    });
  });

  describe('shouldIncludeInResults', () => {
    it('includes FRESH prices', () => {
      expect(shouldIncludeInResults(new Date())).toBe(true);
    });

    it('includes AGING prices', () => {
      const tenHours = new Date(Date.now() - 10 * 60 * 60 * 1000);
      expect(shouldIncludeInResults(tenHours)).toBe(true);
    });

    it('includes STALE prices', () => {
      const fortyEight = new Date(Date.now() - 48 * 60 * 60 * 1000);
      expect(shouldIncludeInResults(fortyEight)).toBe(true);
    });

    it('excludes EXPIRED prices', () => {
      const fourDays = new Date(Date.now() - 96 * 60 * 60 * 1000);
      expect(shouldIncludeInResults(fourDays)).toBe(false);
    });
  });
});
