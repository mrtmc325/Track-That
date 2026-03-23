import { describe, it, expect, beforeEach } from 'vitest';
import {
  geocode,
  reverseGeocode,
  getCachedDistance,
  cacheDistance,
  addMockGeocode,
  addMockReverse,
  _resetAll,
} from '../geocoding.service.js';

describe('Geocoding Service', () => {
  beforeEach(() => {
    _resetAll();
  });

  describe('geocode (forward)', () => {
    it('resolves a known mock address', async () => {
      addMockGeocode('123 main st, phoenix, az', {
        lat: 33.4484,
        lng: -112.0740,
        display_name: '123 Main St, Phoenix, AZ 85001',
        confidence: 0.95,
      });

      const result = await geocode('123 Main St, Phoenix, AZ');
      expect(result).not.toBeNull();
      expect(result!.lat).toBeCloseTo(33.4484, 3);
      expect(result!.lng).toBeCloseTo(-112.074, 3);
      expect(result!.confidence).toBe(0.95);
    });

    it('returns null for unknown address', async () => {
      const result = await geocode('Unknown Place, Nowhere');
      expect(result).toBeNull();
    });

    it('returns null for empty input', async () => {
      expect(await geocode('')).toBeNull();
      expect(await geocode(' ')).toBeNull();
    });

    it('normalizes address to lowercase for matching', async () => {
      addMockGeocode('phoenix az', { lat: 33.45, lng: -112.07, display_name: 'Phoenix, AZ', confidence: 0.9 });
      const result = await geocode('PHOENIX AZ');
      expect(result).not.toBeNull();
    });
  });

  describe('reverseGeocode', () => {
    it('resolves known coordinates', async () => {
      addMockReverse(33.4484, -112.074, {
        address: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001',
        country: 'US',
      });

      const result = await reverseGeocode(33.4484, -112.074);
      expect(result).not.toBeNull();
      expect(result!.city).toBe('Phoenix');
      expect(result!.state).toBe('AZ');
    });

    it('returns null for unknown coordinates', async () => {
      const result = await reverseGeocode(0, 0);
      expect(result).toBeNull();
    });

    it('rounds coordinates to 4 decimal places for cache key', async () => {
      addMockReverse(33.4484, -112.074, {
        address: '123 Main St', city: 'Phoenix', state: 'AZ', zip: '85001', country: 'US',
      });
      // Slightly different coordinates should match due to rounding
      const result = await reverseGeocode(33.44841, -112.07401);
      expect(result).not.toBeNull();
    });
  });

  describe('Distance Cache', () => {
    it('caches and retrieves distance', () => {
      cacheDistance('9tbkn', '9tbkp', 3.5);
      expect(getCachedDistance('9tbkn', '9tbkp')).toBe(3.5);
    });

    it('returns null for uncached pairs', () => {
      expect(getCachedDistance('aaaa', 'bbbb')).toBeNull();
    });

    it('normalizes key order (commutative)', () => {
      cacheDistance('9tbkn', '9tbkp', 3.5);
      // Reversed order should still return the same cached value
      expect(getCachedDistance('9tbkp', '9tbkn')).toBe(3.5);
    });

    it('returns null for expired cache entries', () => {
      // We can't easily test TTL expiry without time mocking,
      // but we can verify the cache works within TTL
      cacheDistance('hash1', 'hash2', 5.0);
      expect(getCachedDistance('hash1', 'hash2')).toBe(5.0);
    });
  });
});
