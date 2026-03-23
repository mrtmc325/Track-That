/**
 * Per-domain request rate limiter for web scraping
 * Per security.threat_model_before_build
 *
 * Mitigates R2: Legal challenges from scraping
 * Enforces 1 request per second per domain (configurable via robots.txt crawl-delay)
 */

const lastRequestTime = new Map<string, number>();

export async function waitForRateLimit(domain: string, crawlDelaySeconds: number | null): Promise<void> {
  const delayMs = (crawlDelaySeconds ?? 1) * 1000; // Default: 1 req/sec
  const lastTime = lastRequestTime.get(domain) ?? 0;
  const elapsed = Date.now() - lastTime;

  if (elapsed < delayMs) {
    await new Promise(resolve => setTimeout(resolve, delayMs - elapsed));
  }

  lastRequestTime.set(domain, Date.now());
}

export function clearRateLimitState(): void {
  lastRequestTime.clear();
}
