// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

/**
 * User profile controllers.
 * requireAuth middleware runs before these — sets req.user = { id, email }.
 * Per security.default_deny_and_explicit_allow — no manual token checks here.
 */

export async function getProfile(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user.id;
  const user = authService.getUserById(userId);

  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  res.json({ success: true, data: user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const userId = (req as any).user.id;

  const updatedUser = authService.updateUser(userId, req.body);
  if (!updatedUser) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  logger.info('user.update', 'Profile updated', { user_id: userId });
  res.json({ success: true, data: updatedUser });
}
