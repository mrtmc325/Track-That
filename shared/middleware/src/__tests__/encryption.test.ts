// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, encryptJson, decryptJson } from '../encryption.js';

describe('AES-256-GCM Encryption (Phase 11 Section 11.5)', () => {
  describe('encrypt/decrypt', () => {
    it('round-trips a simple string', () => {
      const plaintext = 'Hello, Track-That!';
      const ciphertext = encrypt(plaintext);
      expect(ciphertext).not.toBe(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const text = 'same input';
      const c1 = encrypt(text);
      const c2 = encrypt(text);
      expect(c1).not.toBe(c2); // Different IVs
      expect(decrypt(c1)).toBe(text);
      expect(decrypt(c2)).toBe(text);
    });

    it('handles empty string', () => {
      const ciphertext = encrypt('');
      expect(decrypt(ciphertext)).toBe('');
    });

    it('handles unicode characters', () => {
      const text = 'Café résumé naïve 日本語';
      expect(decrypt(encrypt(text))).toBe(text);
    });

    it('handles long strings', () => {
      const text = 'x'.repeat(10000);
      expect(decrypt(encrypt(text))).toBe(text);
    });

    it('throws on tampered ciphertext', () => {
      const ciphertext = encrypt('secret data');
      // Flip a byte in the middle
      const bytes = Buffer.from(ciphertext, 'base64');
      bytes[bytes.length - 5] ^= 0xFF;
      const tampered = bytes.toString('base64');
      expect(() => decrypt(tampered)).toThrow();
    });

    it('throws on truncated ciphertext', () => {
      expect(() => decrypt('dG9vIHNob3J0')).toThrow('too short');
    });

    it('produces base64-encoded output', () => {
      const ciphertext = encrypt('test');
      // Should be valid base64
      expect(() => Buffer.from(ciphertext, 'base64')).not.toThrow();
    });
  });

  describe('encryptJson/decryptJson', () => {
    it('round-trips a JSON object', () => {
      const data = { api_key: 'sk-test-123', webhook_url: 'https://store.com/api', selectors: { price: '.price', name: '.product-name' } };
      const encrypted = encryptJson(data);
      const decrypted = decryptJson(encrypted);
      expect(decrypted).toEqual(data);
    });

    it('handles nested objects', () => {
      const data = { level1: { level2: { level3: 'deep value' } } };
      expect(decryptJson(encryptJson(data))).toEqual(data);
    });

    it('handles arrays in JSON', () => {
      const data = { items: [1, 2, 3], tags: ['a', 'b'] };
      expect(decryptJson(encryptJson(data))).toEqual(data);
    });

    it('encrypts adapter_config for stores (real use case)', () => {
      const adapterConfig = {
        base_url: 'https://store.example.com',
        product_list_url: '/api/products',
        auth_header: 'Bearer sk-secret-key-12345',
        rate_limit_per_second: 1,
        css_selectors: {
          product_name: '.product-title',
          price: '.price-current',
          original_price: '.price-original',
        },
      };
      const encrypted = encryptJson(adapterConfig);
      // Encrypted string should not contain any of the sensitive values
      expect(encrypted).not.toContain('sk-secret-key');
      expect(encrypted).not.toContain('Bearer');
      // Decrypted should match original
      expect(decryptJson(encrypted)).toEqual(adapterConfig);
    });
  });
});
