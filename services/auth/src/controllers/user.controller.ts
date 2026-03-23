import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { logger } from '../utils/logger.js';

/**
 * Authenticate middleware sets req.user = { id, email } from JWT.
 * These controllers assume that middleware has already run.
 */

export async function getProfile(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const decoded = authService.verifyAccessToken(token);
  if (!decoded) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    return;
  }

  const user = authService.getUserById(decoded.sub);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    return;
  }

  res.json({ success: true, data: user });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.access_token;
  if (!token) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const decoded = authService.verifyAccessToken(token);
  if (!decoded) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    return;
  }

  // For now, log the update request (DB integration in next sprint)
  logger.info('user.update', 'Profile update requested', { user_id: decoded.sub });

  res.json({
    success: true,
    data: { message: 'Profile update accepted', updates: req.body },
  });
}
