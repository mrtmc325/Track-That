import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { RegisterInput, LoginInput } from '../schemas/auth.schema.js';

// Per security.strong_authn_and_centralized_authz — all auth logic centralized here
// Per security.no_sensitive_data_in_logs — passwords and tokens never logged

const BCRYPT_ROUNDS = 12; // Cost factor per plan spec

// In-memory store for dev (replaced by Prisma DB in integration)
interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  default_location_lat: number | null;
  default_location_lng: number | null;
  search_radius_miles: number;
  preferred_categories: string[];
  notify_price_drops: boolean;
  notify_deal_alerts: boolean;
  notify_order_updates: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RefreshTokenRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

// Dev-mode in-memory stores (will be replaced with Prisma when DB is connected)
const users = new Map<string, UserRecord>();
const usersByEmail = new Map<string, UserRecord>();
const refreshTokens = new Map<string, RefreshTokenRecord>();

// JWT key pair — in production, loaded from file/secret manager
// For dev, generate ephemeral keys
let jwtPrivateKey: string;
let jwtPublicKey: string;

function initKeys(): void {
  // In production: read from JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH
  // For dev without key files, use HMAC fallback
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    if (config.JWT_PRIVATE_KEY_PATH && config.JWT_PUBLIC_KEY_PATH) {
      jwtPrivateKey = fs.readFileSync(config.JWT_PRIVATE_KEY_PATH, 'utf-8');
      jwtPublicKey = fs.readFileSync(config.JWT_PUBLIC_KEY_PATH, 'utf-8');
      logger.info('auth.keys', 'Loaded RS256 key pair from files');
      return;
    }
  } catch { /* fall through to dev keys */ }

  // Dev-mode: use a symmetric secret (HS256) as fallback
  const jwtSecret = (config as Record<string, string>)['JWT_SECRET'] || crypto.randomBytes(64).toString('hex');
  jwtPrivateKey = jwtSecret;
  jwtPublicKey = jwtSecret;
  logger.warning('auth.keys', 'Using HS256 dev-mode JWT signing (not for production)');
}

initKeys();

/**
 * Hash a password with bcrypt at cost factor 12.
 * Cost 12 = ~250ms on modern hardware — balances security vs UX.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT access token.
 * Short-lived (15 min) per security.strong_authn_and_centralized_authz.
 */
export function generateAccessToken(userId: string, email: string): string {
  return jwt.sign(
    { sub: userId, email },
    jwtPrivateKey,
    { algorithm: jwtPublicKey === jwtPrivateKey ? 'HS256' : 'RS256', expiresIn: '15m' },
  );
}

/**
 * Generate an opaque refresh token.
 * Single-use, rotated on each refresh per plan spec.
 */
export async function generateRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const record: RefreshTokenRecord = {
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: tokenHash,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    revoked: false,
    created_at: new Date(),
  };
  refreshTokens.set(record.id, record);

  return token;
}

/**
 * Verify and consume a refresh token (single-use rotation).
 * Returns the user_id if valid, null otherwise.
 */
export async function verifyRefreshToken(token: string): Promise<string | null> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  for (const [, record] of refreshTokens) {
    if (record.token_hash === tokenHash && !record.revoked && record.expires_at > new Date()) {
      // Revoke after use (single-use rotation)
      record.revoked = true;
      return record.user_id;
    }
  }
  return null;
}

/**
 * Revoke all refresh tokens for a user (logout).
 */
export async function revokeAllTokens(userId: string): Promise<void> {
  for (const record of refreshTokens.values()) {
    if (record.user_id === userId) {
      record.revoked = true;
    }
  }
}

export async function register(input: RegisterInput): Promise<{ user: Omit<UserRecord, 'password_hash'>; accessToken: string; refreshToken: string }> {
  // Check email uniqueness — generic error to prevent user enumeration
  if (usersByEmail.has(input.email)) {
    throw new Error('REGISTRATION_FAILED');
  }

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(input.password);

  const user: UserRecord = {
    id,
    email: input.email,
    password_hash: passwordHash,
    display_name: input.display_name,
    default_location_lat: null,
    default_location_lng: null,
    search_radius_miles: 25,
    preferred_categories: [],
    notify_price_drops: true,
    notify_deal_alerts: true,
    notify_order_updates: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  users.set(id, user);
  usersByEmail.set(input.email, user);

  const accessToken = generateAccessToken(id, input.email);
  const refreshToken = await generateRefreshToken(id);

  logger.notice('auth.register', 'User registered', { user_id: id });

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function login(input: LoginInput): Promise<{ user: Omit<UserRecord, 'password_hash'>; accessToken: string; refreshToken: string } | null> {
  const user = usersByEmail.get(input.email);
  if (!user) {
    logger.info('auth.login_failed', 'User not found', { email_hash: crypto.createHash('sha256').update(input.email).digest('hex').substring(0, 8) });
    return null;
  }

  const valid = await verifyPassword(input.password, user.password_hash);
  if (!valid) {
    logger.info('auth.login_failed', 'Invalid password', { user_id: user.id });
    return null;
  }

  const accessToken = generateAccessToken(user.id, user.email);
  const refreshToken = await generateRefreshToken(user.id);

  logger.notice('auth.login', 'User logged in', { user_id: user.id });

  const { password_hash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export function getUserById(id: string): Omit<UserRecord, 'password_hash'> | null {
  const user = users.get(id);
  if (!user) return null;
  const { password_hash: _, ...safeUser } = user;
  return safeUser;
}

export function verifyAccessToken(token: string): { sub: string; email: string } | null {
  try {
    const decoded = jwt.verify(token, jwtPublicKey) as { sub: string; email: string };
    return decoded;
  } catch {
    return null;
  }
}

// Export for testing
export function _resetStores(): void {
  users.clear();
  usersByEmail.clear();
  refreshTokens.clear();
}
