// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
import { Request, Response } from 'express';
import { getSession, markSolved, refreshScreenshot, deleteSession, getPendingSessions } from '../services/captcha.service.js';
import { logger } from '../utils/logger.js';

/** GET /captcha/pending — check for any unsolved CAPTCHA sessions */
export async function getPending(_req: Request, res: Response): Promise<void> {
  const pending = getPendingSessions();
  res.json({ success: true, data: { sessions: pending } });
}

/** GET /captcha/:id/screenshot — return current page screenshot */
export async function getScreenshot(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

  const screenshot = await refreshScreenshot(req.params.id);
  res.json({ success: true, data: { screenshot: screenshot || session.screenshot, solved: session.solved } });
}

/** GET /captcha/:id/status — check if CAPTCHA is solved */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }
  res.json({ success: true, data: { solved: session.solved, domain: session.domain } });
}

/** POST /captcha/:id/click — relay click to Puppeteer page */
export async function sendClick(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

  const { x, y } = req.body;
  if (typeof x !== 'number' || typeof y !== 'number') {
    res.status(400).json({ success: false, error: 'x and y coordinates required' }); return;
  }

  try {
    await session.page.mouse.click(x, y);
    logger.info('captcha.click', `Click relayed at (${x}, ${y})`, { id: req.params.id, x, y });
    // Take fresh screenshot after click
    const screenshot = await refreshScreenshot(req.params.id);
    res.json({ success: true, data: { screenshot } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
}

/** POST /captcha/:id/hold — relay press-and-hold (Walmart CAPTCHA) */
export async function sendHold(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

  const { x, y, duration } = req.body;
  const holdMs = duration || 3000; // Default 3 seconds

  try {
    await session.page.mouse.move(x, y);
    await session.page.mouse.down();
    // Hold for the specified duration
    await new Promise(r => setTimeout(r, holdMs));
    await session.page.mouse.up();

    logger.info('captcha.hold', `Hold relayed at (${x}, ${y}) for ${holdMs}ms`, { id: req.params.id, x, y, duration: holdMs });

    // Wait a moment for page to react, then screenshot
    await new Promise(r => setTimeout(r, 2000));
    const screenshot = await refreshScreenshot(req.params.id);
    res.json({ success: true, data: { screenshot } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
}

/** POST /captcha/:id/type — relay keyboard input */
export async function sendType(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

  const { text } = req.body;
  if (!text) { res.status(400).json({ success: false, error: 'text required' }); return; }

  try {
    await session.page.keyboard.type(text, { delay: 50 });
    const screenshot = await refreshScreenshot(req.params.id);
    res.json({ success: true, data: { screenshot } });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
}

/** POST /captcha/:id/done — mark CAPTCHA as solved */
export async function markDone(req: Request, res: Response): Promise<void> {
  const session = getSession(req.params.id);
  if (!session) { res.status(404).json({ success: false, error: 'Session not found' }); return; }

  markSolved(req.params.id);
  res.json({ success: true, data: { solved: true } });
}
