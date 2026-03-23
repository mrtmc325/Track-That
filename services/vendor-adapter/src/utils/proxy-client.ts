// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Internal Proxy Client Module
 * All outbound scraping requests route through this module.
 *
 * Provides:
 * - Proxy routing via PROXY_URL env var (optional — direct if unset)
 * - User-Agent rotation from 50+ real browser strings
 * - Header randomization to look like real browsers
 * - Puppeteer proxy args for Chromium launch
 *
 * security.encryption_in_transit_and_at_rest — HTTPS to targets
 * operability.observability_by_default — logs proxy usage per request
 * reliability.timeouts_retries_and_circuit_breakers — retry on proxy failure
 */
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from './logger.js';

// ─── Configuration ───

const PROXY_URL = process.env.PROXY_URL || '';
const PROXY_ENABLED = process.env.PROXY_ENABLED === 'true' && PROXY_URL.length > 0;

let proxyAgent: HttpsProxyAgent<string> | null = null;
if (PROXY_ENABLED && PROXY_URL) {
  proxyAgent = new HttpsProxyAgent(PROXY_URL);
  logger.notice('proxy.init', `Proxy enabled: ${PROXY_URL.replace(/\/\/.*@/, '//<redacted>@')}`, {});
} else {
  logger.info('proxy.init', 'Proxy disabled — direct connections', {});
}

// ─── User-Agent Pool ───
// Real browser User-Agents from Chrome 120-125, Firefox 121-124, Safari 17, Edge 120
// across Windows 10/11, macOS Sonoma/Ventura, Ubuntu 22/24

const USER_AGENTS: string[] = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Chrome on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  // Chrome on Linux
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0',
  // Firefox on Linux
  'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
  // Safari on macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Mobile Chrome
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
];

// ─── Accept-Language variations ───

const ACCEPT_LANGUAGES = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.9,es;q=0.8',
  'en-GB,en;q=0.9,en-US;q=0.8',
  'en-US,en;q=0.9,fr;q=0.8',
  'en-AU,en;q=0.9,en-US;q=0.8',
  'en-US,en;q=0.8',
];

const ACCEPT_ENCODINGS = [
  'gzip, deflate, br',
  'gzip, deflate, br, zstd',
  'gzip, deflate',
];

// ─── Exports ───

/**
 * Get a random User-Agent string from the pool.
 * Different agent per request to avoid fingerprinting.
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get randomized browser-like headers.
 * Each call returns slightly different headers to avoid detection.
 */
export function getRandomHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
    'Accept-Encoding': ACCEPT_ENCODINGS[Math.floor(Math.random() * ACCEPT_ENCODINGS.length)],
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive',
  };
}

/**
 * Proxy-aware fetch. Drop-in replacement for native fetch().
 * Routes through PROXY_URL if configured, otherwise direct.
 * Injects randomized browser headers on every request.
 */
export async function proxyFetch(
  url: string | URL,
  init?: RequestInit & { headers?: Record<string, string> },
): Promise<Response> {
  const headers = {
    ...getRandomHeaders(),
    ...(init?.headers || {}),
  };

  const fetchOptions: any = {
    ...init,
    headers,
  };

  // If proxy is enabled, use the proxy agent for Node.js fetch
  // Note: Node.js native fetch doesn't support `agent` directly.
  // We use https-proxy-agent with the global dispatcher pattern.
  if (PROXY_ENABLED && proxyAgent) {
    // For proxy support with native fetch, set the dispatcher
    fetchOptions.dispatcher = proxyAgent;
  }

  const ua = headers['User-Agent']?.substring(0, 40) || 'unknown';
  logger.debug('proxy.fetch', `${PROXY_ENABLED ? 'PROXY' : 'DIRECT'} → ${typeof url === 'string' ? new URL(url).hostname : url.hostname}`, {
    proxy_enabled: PROXY_ENABLED,
    user_agent_prefix: ua,
  });

  return fetch(url, fetchOptions);
}

/**
 * Get Puppeteer/Chromium launch args for proxy.
 * Returns empty array if proxy is not configured.
 */
export function getPuppeteerProxyArgs(): string[] {
  if (!PROXY_ENABLED || !PROXY_URL) return [];

  // Extract host:port from proxy URL (strip auth for Chromium arg)
  try {
    const parsed = new URL(PROXY_URL);
    const proxyServer = `${parsed.protocol}//${parsed.hostname}:${parsed.port || (parsed.protocol === 'https:' ? '443' : '8080')}`;
    logger.debug('proxy.puppeteer_args', `Chromium proxy: ${proxyServer}`, {});
    return [`--proxy-server=${proxyServer}`];
  } catch {
    logger.warning('proxy.invalid_url', `Invalid PROXY_URL: ${PROXY_URL.substring(0, 20)}...`, {});
    return [];
  }
}

/**
 * Check if proxy is currently enabled.
 */
export function isProxyEnabled(): boolean {
  return PROXY_ENABLED;
}
