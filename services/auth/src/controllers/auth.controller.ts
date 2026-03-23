import { Request, Response } from 'express';
import * as authService from '../services/auth.service.js';
import { recordFailedAttempt, clearAttempts } from '../middleware/rate-limit.js';
import { setCsrfToken } from '../middleware/csrf.js';
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
    setCsrfToken(res);

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
    setCsrfToken(res);

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

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    // Always return success to prevent user enumeration
    const token = await authService.generatePasswordResetToken(req.body.email);

    if (token) {
      // In production: send email with reset link containing the token
      // For dev: log token (NOT in production — security.no_sensitive_data_in_logs)
      logger.debug('auth.forgot_password', 'Reset token generated (dev only)', {
        email_hash: require('node:crypto').createHash('sha256').update(req.body.email).digest('hex').substring(0, 8),
      });
    }

    // Generic response regardless of whether email exists
    res.json({
      success: true,
      data: { message: 'If that email is registered, a reset link has been sent.' },
    });
  } catch (error) {
    logger.error('auth.forgot_password', 'Forgot password error', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const success = await authService.resetPassword(req.body.token, req.body.password);

    if (!success) {
      // Generic error — don't reveal if token was invalid vs expired
      res.status(400).json({
        success: false,
        error: { code: 'RESET_FAILED', message: 'Password reset failed. Token may be invalid or expired.' },
      });
      return;
    }

    // Clear any existing auth cookies since all sessions were revoked
    res.clearCookie('access_token', { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' });
    res.clearCookie('refresh_token', { httpOnly: true, secure: true, sameSite: 'strict' as const, path: '/' });

    res.json({
      success: true,
      data: { message: 'Password has been reset. Please log in with your new password.' },
    });
  } catch (error) {
    logger.error('auth.reset_password', 'Reset password error', { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  }
}
