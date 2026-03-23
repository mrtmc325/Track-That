import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeAllTokens,
  register,
  login,
  getUserById,
  generatePasswordResetToken,
  resetPassword,
  updateUser,
  _resetStores,
} from '../../services/auth.service.js';

describe('Auth Service', () => {
  beforeEach(() => {
    _resetStores();
  });

  describe('Password Hashing', () => {
    it('hashes a password with bcrypt', async () => {
      const hash = await hashPassword('TestPass1');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPass1');
      expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix
    });

    it('verifies correct password', async () => {
      const hash = await hashPassword('TestPass1');
      expect(await verifyPassword('TestPass1', hash)).toBe(true);
    });

    it('rejects incorrect password', async () => {
      const hash = await hashPassword('TestPass1');
      expect(await verifyPassword('WrongPass1', hash)).toBe(false);
    });

    it('produces different hashes for same password (salted)', async () => {
      const h1 = await hashPassword('TestPass1');
      const h2 = await hashPassword('TestPass1');
      expect(h1).not.toBe(h2);
    });
  });

  describe('JWT Tokens', () => {
    it('generates a valid access token', () => {
      const token = generateAccessToken('user-123', 'test@example.com');
      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('verifies a valid token and returns payload', () => {
      const token = generateAccessToken('user-123', 'test@example.com');
      const decoded = verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.sub).toBe('user-123');
      expect(decoded!.email).toBe('test@example.com');
    });

    it('rejects an invalid token', () => {
      expect(verifyAccessToken('invalid.token.here')).toBeNull();
    });

    it('rejects a tampered token', () => {
      const token = generateAccessToken('user-123', 'test@example.com');
      const tampered = token.slice(0, -5) + 'XXXXX';
      expect(verifyAccessToken(tampered)).toBeNull();
    });
  });

  describe('Refresh Tokens', () => {
    it('generates a UUID refresh token', async () => {
      const token = await generateRefreshToken('user-123');
      expect(token).toBeDefined();
      // UUID v4 format
      expect(token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('verifies a valid refresh token', async () => {
      const token = await generateRefreshToken('user-123');
      const userId = await verifyRefreshToken(token);
      expect(userId).toBe('user-123');
    });

    it('rejects an unknown refresh token', async () => {
      const userId = await verifyRefreshToken('00000000-0000-4000-8000-000000000000');
      expect(userId).toBeNull();
    });

    it('enforces single-use (token rotation)', async () => {
      const token = await generateRefreshToken('user-123');
      // First use succeeds
      const first = await verifyRefreshToken(token);
      expect(first).toBe('user-123');
      // Second use fails (revoked after first use)
      const second = await verifyRefreshToken(token);
      expect(second).toBeNull();
    });

    it('revokes all tokens for a user on logout', async () => {
      const t1 = await generateRefreshToken('user-123');
      const t2 = await generateRefreshToken('user-123');
      await revokeAllTokens('user-123');
      expect(await verifyRefreshToken(t1)).toBeNull();
      expect(await verifyRefreshToken(t2)).toBeNull();
    });
  });

  describe('Registration', () => {
    it('registers a new user successfully', async () => {
      const result = await register({
        email: 'new@example.com',
        password: 'SecurePass1',
        display_name: 'Test User',
      });
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.display_name).toBe('Test User');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      // Password hash not exposed
      expect((result.user as any).password_hash).toBeUndefined();
    });

    it('rejects duplicate email registration', async () => {
      await register({ email: 'dup@example.com', password: 'SecurePass1', display_name: 'User 1' });
      await expect(
        register({ email: 'dup@example.com', password: 'SecurePass1', display_name: 'User 2' })
      ).rejects.toThrow('REGISTRATION_FAILED');
    });

    it('sets default profile values', async () => {
      const result = await register({
        email: 'defaults@example.com',
        password: 'SecurePass1',
        display_name: 'Defaults',
      });
      expect(result.user.search_radius_miles).toBe(25);
      expect(result.user.preferred_categories).toEqual([]);
      expect(result.user.notify_price_drops).toBe(true);
    });
  });

  describe('Login', () => {
    beforeEach(async () => {
      await register({ email: 'login@example.com', password: 'SecurePass1', display_name: 'Login User' });
    });

    it('logs in with valid credentials', async () => {
      const result = await login({ email: 'login@example.com', password: 'SecurePass1' });
      expect(result).not.toBeNull();
      expect(result!.user.email).toBe('login@example.com');
      expect(result!.accessToken).toBeDefined();
      expect(result!.refreshToken).toBeDefined();
    });

    it('returns null for invalid email', async () => {
      const result = await login({ email: 'wrong@example.com', password: 'SecurePass1' });
      expect(result).toBeNull();
    });

    it('returns null for invalid password', async () => {
      const result = await login({ email: 'login@example.com', password: 'WrongPass1' });
      expect(result).toBeNull();
    });

    it('never exposes password hash', async () => {
      const result = await login({ email: 'login@example.com', password: 'SecurePass1' });
      expect((result!.user as any).password_hash).toBeUndefined();
    });
  });

  describe('getUserById', () => {
    it('returns user without password hash', async () => {
      const reg = await register({ email: 'getme@example.com', password: 'SecurePass1', display_name: 'Get Me' });
      const user = getUserById(reg.user.id);
      expect(user).not.toBeNull();
      expect(user!.email).toBe('getme@example.com');
      expect((user as any).password_hash).toBeUndefined();
    });

    it('returns null for unknown id', () => {
      expect(getUserById('nonexistent')).toBeNull();
    });
  });

  describe('Password Reset', () => {
    let userId: string;

    beforeEach(async () => {
      const reg = await register({ email: 'reset@example.com', password: 'OldPass1', display_name: 'Reset User' });
      userId = reg.user.id;
    });

    it('generates a reset token for existing email', async () => {
      const token = await generatePasswordResetToken('reset@example.com');
      expect(token).not.toBeNull();
      expect(token).toMatch(/^[0-9a-f]{8}-/i); // UUID format
    });

    it('returns null for non-existent email (no enumeration)', async () => {
      const token = await generatePasswordResetToken('nobody@example.com');
      expect(token).toBeNull();
    });

    it('resets password with valid token', async () => {
      const token = await generatePasswordResetToken('reset@example.com');
      const success = await resetPassword(token!, 'NewPass1');
      expect(success).toBe(true);

      // Old password should fail
      const oldLogin = await login({ email: 'reset@example.com', password: 'OldPass1' });
      expect(oldLogin).toBeNull();

      // New password should work
      const newLogin = await login({ email: 'reset@example.com', password: 'NewPass1' });
      expect(newLogin).not.toBeNull();
    });

    it('token is single-use', async () => {
      const token = await generatePasswordResetToken('reset@example.com');
      await resetPassword(token!, 'NewPass1');
      const secondUse = await resetPassword(token!, 'AnotherPass1');
      expect(secondUse).toBe(false);
    });

    it('rejects invalid token', async () => {
      const success = await resetPassword('00000000-0000-4000-8000-000000000000', 'NewPass1');
      expect(success).toBe(false);
    });

    it('revokes all sessions after reset', async () => {
      // Create a refresh token
      const refreshTok = await generateRefreshToken(userId);
      // Reset password
      const resetTok = await generatePasswordResetToken('reset@example.com');
      await resetPassword(resetTok!, 'NewPass1');
      // Old refresh token should be revoked
      const result = await verifyRefreshToken(refreshTok);
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('updates display name', async () => {
      const reg = await register({ email: 'upd@example.com', password: 'SecurePass1', display_name: 'Old' });
      const updated = updateUser(reg.user.id, { display_name: 'New Name' });
      expect(updated).not.toBeNull();
      expect(updated!.display_name).toBe('New Name');
    });

    it('updates search radius', async () => {
      const reg = await register({ email: 'rad@example.com', password: 'SecurePass1', display_name: 'Rad' });
      const updated = updateUser(reg.user.id, { search_radius_miles: 10 });
      expect(updated!.search_radius_miles).toBe(10);
    });

    it('ignores non-allowed fields', async () => {
      const reg = await register({ email: 'safe@example.com', password: 'SecurePass1', display_name: 'Safe' });
      const updated = updateUser(reg.user.id, { email: 'hacked@evil.com', password_hash: 'evil' });
      expect(updated!.email).toBe('safe@example.com');
      expect((updated as any).password_hash).toBeUndefined();
    });

    it('returns null for unknown user', () => {
      expect(updateUser('nonexistent', { display_name: 'X' })).toBeNull();
    });

    it('does not expose password hash', async () => {
      const reg = await register({ email: 'nohash@example.com', password: 'SecurePass1', display_name: 'NoHash' });
      const updated = updateUser(reg.user.id, { display_name: 'Updated' });
      expect((updated as any).password_hash).toBeUndefined();
    });
  });
});
