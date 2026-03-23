import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { recordFailedAttempt, clearAttempts } from '../middleware/rate-limit.js';
import { logger } from '../utils/logger.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/',
};

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.register(req.body);

    // Set auth cookies per plan spec (HttpOnly, Secure, SameSite=Strict)
    res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', result.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.status(201).json({
      success: true,
      data: { user: result.user },
    });
  } catch (error) {
    // Generic error to prevent user enumeration
    if (error instanceof Error && error.message === 'REGISTRATION_FAILED') {
      res.status(409).json({
        success: false,
        error: { code: 'REGISTRATION_FAILED', message: 'Registration failed' },
      });
      return;
    }
    logger.error('auth.register', 'Registration error', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  try {
    const result = await authService.login(req.body);

    if (!result) {
      recordFailedAttempt(ip, req.body.email);
      // Generic error — no user enumeration
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
      return;
    }

    clearAttempts(ip, req.body.email);

    res.cookie('access_token', result.accessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', result.refreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ success: true, data: { user: result.user } });
  } catch (error) {
    logger.error('auth.login', 'Login error', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.access_token;
  if (token) {
    const decoded = authService.verifyAccessToken(token);
    if (decoded) {
      await authService.revokeAllTokens(decoded.sub);
      logger.notice('auth.logout', 'User logged out', { user_id: decoded.sub });
    }
  }

  res.clearCookie('access_token', COOKIE_OPTIONS);
  res.clearCookie('refresh_token', COOKIE_OPTIONS);
  res.json({ success: true, data: { message: 'Logged out' } });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Refresh token required' },
    });
    return;
  }

  const userId = await authService.verifyRefreshToken(refreshToken);
  if (!userId) {
    res.clearCookie('access_token', COOKIE_OPTIONS);
    res.clearCookie('refresh_token', COOKIE_OPTIONS);
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' },
    });
    return;
  }

  const user = authService.getUserById(userId);
  if (!user) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'User not found' },
    });
    return;
  }

  // Token rotation: issue new pair
  const newAccessToken = authService.generateAccessToken(userId, user.email);
  const newRefreshToken = await authService.generateRefreshToken(userId);

  res.cookie('access_token', newAccessToken, { ...COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', newRefreshToken, { ...COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

  res.json({ success: true, data: { user } });
}
