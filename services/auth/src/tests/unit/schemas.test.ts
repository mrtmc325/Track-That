// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, updateProfileSchema } from '../../schemas/auth.schema.js';

describe('Auth Schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid registration', () => {
      const result = registerSchema.safeParse({
        email: 'Test@Example.COM',
        password: 'SecurePass1',
        display_name: 'Test User',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com'); // lowercased
      }
    });

    it('rejects short password', () => {
      expect(registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Short1',
        display_name: 'User',
      }).success).toBe(false);
    });

    it('rejects password without uppercase', () => {
      expect(registerSchema.safeParse({
        email: 'test@example.com',
        password: 'nouppercase1',
        display_name: 'User',
      }).success).toBe(false);
    });

    it('rejects password without number', () => {
      expect(registerSchema.safeParse({
        email: 'test@example.com',
        password: 'NoNumberHere',
        display_name: 'User',
      }).success).toBe(false);
    });

    it('rejects invalid email', () => {
      expect(registerSchema.safeParse({
        email: 'not-an-email',
        password: 'SecurePass1',
        display_name: 'User',
      }).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login', () => {
      const result = loginSchema.safeParse({
        email: 'user@example.com',
        password: 'anything',
      });
      expect(result.success).toBe(true);
    });

    it('lowercases email', () => {
      const result = loginSchema.parse({ email: 'USER@EXAMPLE.COM', password: 'test' });
      expect(result.email).toBe('user@example.com');
    });
  });

  describe('updateProfileSchema', () => {
    it('accepts partial updates', () => {
      expect(updateProfileSchema.safeParse({ display_name: 'New Name' }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ search_radius_miles: 10 }).success).toBe(true);
      expect(updateProfileSchema.safeParse({}).success).toBe(true);
    });

    it('rejects radius > 50', () => {
      expect(updateProfileSchema.safeParse({ search_radius_miles: 100 }).success).toBe(false);
    });

    it('rejects invalid coordinates', () => {
      expect(updateProfileSchema.safeParse({ default_location_lat: 100 }).success).toBe(false);
      expect(updateProfileSchema.safeParse({ default_location_lng: 200 }).success).toBe(false);
    });
  });
});
