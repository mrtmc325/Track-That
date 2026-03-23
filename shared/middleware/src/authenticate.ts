// Centralized auth per security.strong_authn_and_centralized_authz
import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '@track-that/types';

interface JwtPayload {
  id: string;
  email: string;
  [key: string]: unknown;
}

// Augment Express Request so downstream handlers can access req.user.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      requestId?: string;
    }
  }
}

// Cache the public key so we only hit the filesystem once per process lifetime.
let cachedPublicKey: string | undefined;

function getPublicKey(): string {
  if (cachedPublicKey !== undefined) return cachedPublicKey;

  const keyPath = process.env['JWT_PUBLIC_KEY_PATH'];
  if (!keyPath) {
    throw new AppError(
      'INTERNAL_ERROR',
      'JWT_PUBLIC_KEY_PATH environment variable is not set.',
      500,
    );
  }

  cachedPublicKey = fs.readFileSync(keyPath, 'utf8');
  return cachedPublicKey;
}

/**
 * Express middleware that enforces JWT authentication.
 *
 * Token resolution order:
 *   1. `req.cookies.access_token` (HttpOnly cookie, preferred for browsers)
 *   2. `Authorization: Bearer <token>` header (preferred for service-to-service)
 *
 * On success, sets `req.user = { id, email }` for downstream handlers.
 * On failure, passes an AppError(UNAUTHORIZED, 401) to `next`.
 */
export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    // Resolve token from cookie or Authorization header.
    const cookieToken: string | undefined =
      (req as Request & { cookies?: Record<string, string> }).cookies?.['access_token'];

    let bearerToken: string | undefined;
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      bearerToken = authHeader.slice(7);
    }

    const token = cookieToken ?? bearerToken;

    if (!token) {
      throw new AppError(
        'UNAUTHORIZED',
        'No authentication token provided.',
        401,
      );
    }

    const publicKey = getPublicKey();
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
    }) as JwtPayload;

    req.user = { id: decoded['id'], email: decoded['email'] };
    next();
  } catch (err) {
    if (err instanceof AppError) {
      next(err);
      return;
    }
    next(
      new AppError(
        'UNAUTHORIZED',
        'Invalid or expired authentication token.',
        401,
        err instanceof Error ? err.message : undefined,
      ),
    );
  }
}
