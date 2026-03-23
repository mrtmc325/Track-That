// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * CAPTCHA Detection & Session Management
 *
 * When Puppeteer hits a CAPTCHA (Walmart PRESS&HOLD, hCaptcha, reCAPTCHA),
 * it stores a session with the page reference. The frontend can then relay
 * user clicks/holds back to the Puppeteer page to solve the CAPTCHA.
 */
import crypto from 'node:crypto';
import type { Page } from 'puppeteer-core';
import { logger } from '../utils/logger.js';

export interface CaptchaSession {
  id: string;
  page: Page;
  domain: string;
  query: string;
  solved: boolean;
  screenshot: string; // base64 PNG
  createdAt: number;
}

// Active CAPTCHA sessions — keyed by session ID
const sessions = new Map<string, CaptchaSession>();

// Auto-cleanup sessions older than 3 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 180000) {
      sessions.delete(id);
      logger.debug('captcha.expired', `Session ${id} expired`, { id });
    }
  }
}, 30000);

/** Known CAPTCHA selectors across major retailers */
const CAPTCHA_SELECTORS = [
  // Walmart PerimeterX "PRESS & HOLD"
  'iframe[src*="px-captcha"]',
  '[id*="px-captcha"]',
  '#px-captcha',
  // PerimeterX generic
  '[class*="PerimeterX"]',
  'div[id*="px-"]',
  // hCaptcha
  '.h-captcha',
  'iframe[src*="hcaptcha.com"]',
  // reCAPTCHA
  '.g-recaptcha',
  'iframe[src*="google.com/recaptcha"]',
  // Generic patterns
  '[data-testid*="captcha"]',
  '[id*="captcha"]',
  '[class*="captcha"]',
  // Text-based detection
  'button:has-text("I am human")',
  'button:has-text("PRESS & HOLD")',
];

/** Text patterns that indicate a CAPTCHA page */
const CAPTCHA_TEXT_PATTERNS = [
  'robot or human',
  'press & hold',
  'press and hold',
  'verify you are human',
  'i am human',
  'complete the security check',
  'checking your browser',
  'please verify',
];

/**
 * Detect if the current page has a CAPTCHA.
 * Returns true + session ID if detected.
 */
export async function detectCaptcha(page: Page, domain: string, query: string): Promise<{
  detected: boolean;
  sessionId: string;
  screenshot: string;
}> {
  try {
    // Check CSS selectors
    for (const selector of CAPTCHA_SELECTORS) {
      try {
        const el = await page.$(selector);
        if (el) {
          return await createSession(page, domain, query, `selector: ${selector}`);
        }
      } catch { /* selector may be invalid for this page */ }
    }

    // Check page text content for CAPTCHA indicators
    const bodyText = await page.evaluate(function() {
      return document.body ? document.body.innerText.toLowerCase() : '';
    });

    for (const pattern of CAPTCHA_TEXT_PATTERNS) {
      if (bodyText.includes(pattern)) {
        return await createSession(page, domain, query, `text: "${pattern}"`);
      }
    }

    return { detected: false, sessionId: '', screenshot: '' };
  } catch (err) {
    logger.error('captcha.detect_error', `Error detecting CAPTCHA: ${(err as Error).message}`, { domain });
    return { detected: false, sessionId: '', screenshot: '' };
  }
}

async function createSession(page: Page, domain: string, query: string, reason: string): Promise<{
  detected: boolean;
  sessionId: string;
  screenshot: string;
}> {
  const sessionId = crypto.randomUUID();
  const screenshot = await page.screenshot({ encoding: 'base64', type: 'png' }) as string;

  sessions.set(sessionId, {
    id: sessionId,
    page,
    domain,
    query,
    solved: false,
    screenshot,
    createdAt: Date.now(),
  });

  logger.notice('captcha.detected', `CAPTCHA detected on ${domain}`, {
    sessionId,
    domain,
    reason,
  });

  return { detected: true, sessionId, screenshot };
}

/** Get a session by ID */
export function getSession(id: string): CaptchaSession | undefined {
  return sessions.get(id);
}

/** Mark session as solved */
export function markSolved(id: string): void {
  const session = sessions.get(id);
  if (session) {
    session.solved = true;
    logger.notice('captcha.solved', `CAPTCHA solved for ${session.domain}`, { id, domain: session.domain });
  }
}

/** Take a fresh screenshot of the session's page */
export async function refreshScreenshot(id: string): Promise<string | null> {
  const session = sessions.get(id);
  if (!session) return null;
  try {
    const screenshot = await session.page.screenshot({ encoding: 'base64', type: 'png' }) as string;
    session.screenshot = screenshot;
    return screenshot;
  } catch {
    return null;
  }
}

/** Delete a session */
export function deleteSession(id: string): void {
  sessions.delete(id);
}

/** Get all pending (unsolved) CAPTCHA sessions */
export function getPendingSessions(): { id: string; domain: string; screenshot: string; createdAt: number }[] {
  const pending: { id: string; domain: string; screenshot: string; createdAt: number }[] = [];
  for (const session of sessions.values()) {
    if (!session.solved) {
      pending.push({ id: session.id, domain: session.domain, screenshot: session.screenshot, createdAt: session.createdAt });
    }
  }
  return pending;
}
