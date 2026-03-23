/**
 * Price staleness classification
 * Per operability.observability_by_default
 *
 * Mitigates R6: Price data accuracy — scraped prices may be wrong or outdated
 *
 * Classification:
 *   FRESH:   < 4 hours since scrape — full confidence
 *   AGING:   4-24 hours — show warning badge
 *   STALE:   24-72 hours — deprioritize in ranking
 *   EXPIRED: > 72 hours — exclude from results entirely
 */

export type PriceFreshness = 'FRESH' | 'AGING' | 'STALE' | 'EXPIRED';

export const FRESHNESS_THRESHOLDS = {
  FRESH_MAX_HOURS: 4,
  AGING_MAX_HOURS: 24,
  STALE_MAX_HOURS: 72,
} as const;

export function classifyFreshness(lastScrapedAt: Date): PriceFreshness {
  const hoursSinceScrape = (Date.now() - lastScrapedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSinceScrape < FRESHNESS_THRESHOLDS.FRESH_MAX_HOURS) return 'FRESH';
  if (hoursSinceScrape < FRESHNESS_THRESHOLDS.AGING_MAX_HOURS) return 'AGING';
  if (hoursSinceScrape < FRESHNESS_THRESHOLDS.STALE_MAX_HOURS) return 'STALE';
  return 'EXPIRED';
}

/**
 * Calculate freshness score for deal ranking (0.0 - 1.0)
 * Used in the price engine's composite deal score
 */
export function freshnessScore(lastScrapedAt: Date): number {
  const hoursSinceScrape = (Date.now() - lastScrapedAt.getTime()) / (1000 * 60 * 60);
  const maxHours = FRESHNESS_THRESHOLDS.STALE_MAX_HOURS; // 72h = 0 score
  return Math.max(0, 1 - hoursSinceScrape / maxHours);
}

/**
 * Should this price be included in search results?
 * EXPIRED prices are excluded entirely to protect user trust.
 */
export function shouldIncludeInResults(lastScrapedAt: Date): boolean {
  return classifyFreshness(lastScrapedAt) !== 'EXPIRED';
}
