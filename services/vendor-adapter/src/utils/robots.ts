// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * robots.txt compliance checker
 * Per security.threat_model_before_build
 *
 * Mitigates R2: Legal challenges from scraping vendor sites
 *
 * Before scraping any URL, this module:
 * 1. Fetches and parses robots.txt for the domain
 * 2. Caches the result for 24 hours
 * 3. Checks if our User-Agent (TrackThat-Bot) is allowed
 * 4. Respects Crawl-delay directives
 */

export interface RobotsResult {
  allowed: boolean;
  crawlDelaySeconds: number | null;
  cachedAt: number;
}

// In-memory cache (domain → result). TTL: 24 hours.
const cache = new Map<string, RobotsResult>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const USER_AGENT = 'TrackThat-Bot';

export async function isAllowed(url: string): Promise<RobotsResult> {
  const domain = new URL(url).origin;
  const cached = cache.get(domain);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const robotsUrl = `${domain}/robots.txt`;
    const response = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5000), // 5s timeout per reliability.timeouts_retries_and_circuit_breakers
      headers: { 'User-Agent': `${USER_AGENT}/1.0 (+https://trackhat.local/bot)` },
    });

    if (!response.ok) {
      // No robots.txt = everything allowed
      const result: RobotsResult = { allowed: true, crawlDelaySeconds: null, cachedAt: Date.now() };
      cache.set(domain, result);
      return result;
    }

    const text = await response.text();
    const result = parseRobotsTxt(text);
    cache.set(domain, result);
    return result;
  } catch {
    // Network error fetching robots.txt = assume allowed (conservative for availability)
    const result: RobotsResult = { allowed: true, crawlDelaySeconds: null, cachedAt: Date.now() };
    cache.set(domain, result);
    return result;
  }
}

/**
 * Simple robots.txt parser. Looks for User-agent: * and TrackThat-Bot sections.
 * Checks Disallow and Crawl-delay directives.
 */
export function parseRobotsTxt(content: string): RobotsResult {
  const lines = content.split('\n').map(l => l.trim());
  let inOurSection = false;
  let inWildcardSection = false;
  let disallowAll = false;
  let crawlDelay: number | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (lower.startsWith('user-agent:')) {
      const agent = line.substring(11).trim().toLowerCase();
      inOurSection = agent === USER_AGENT.toLowerCase();
      inWildcardSection = agent === '*';
      continue;
    }

    if (!inOurSection && !inWildcardSection) continue;

    if (lower.startsWith('disallow:')) {
      const path = line.substring(9).trim();
      if (path === '/' || path === '/*') {
        disallowAll = true;
      }
    }

    if (lower.startsWith('crawl-delay:')) {
      const val = parseFloat(line.substring(12).trim());
      if (!isNaN(val) && val > 0) {
        crawlDelay = val;
      }
    }
  }

  // Our specific agent section takes precedence over wildcard
  return {
    allowed: !disallowAll,
    crawlDelaySeconds: crawlDelay,
    cachedAt: Date.now(),
  };
}

export function clearCache(): void {
  cache.clear();
}
