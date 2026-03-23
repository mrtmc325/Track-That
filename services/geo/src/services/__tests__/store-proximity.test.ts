import { describe, it, expect, beforeEach } from 'vitest';
import {
  queryNearbyStores,
  distanceToStore,
  registerStore,
  getStore,
  _resetStores,
  type GeoStore,
} from '../store-proximity.service.js';
import { _resetAll as resetGeoCache } from '../geocoding.service.js';

function makeStore(overrides: Partial<GeoStore> = {}): GeoStore {
  return {
    id: 'store-' + Math.random().toString(36).slice(2, 8),
    name: 'Test Store',
    address: '123 Main St',
    city: 'Phoenix',
    state: 'AZ',
    zip: '85001',
    lat: 33.4484,
    lng: -112.0740,
    store_type: 'grocery',
    is_active: true,
    avg_rating: 4.5,
    product_count: 100,
    ...overrides,
  };
}

describe('Store Proximity Service', () => {
  beforeEach(() => {
    _resetStores();
    resetGeoCache();
  });

  describe('queryNearbyStores', () => {
    it('finds stores within radius', () => {
      registerStore(makeStore({ id: 'near', lat: 33.45, lng: -112.07 }));
      registerStore(makeStore({ id: 'far', lat: 40.0, lng: -100.0 })); // ~800 miles away

      const results = queryNearbyStores(33.45, -112.07, 10);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('near');
    });

    it('sorts by distance ascending', () => {
      registerStore(makeStore({ id: 's1', name: 'Far', lat: 33.50, lng: -112.10 }));
      registerStore(makeStore({ id: 's2', name: 'Near', lat: 33.451, lng: -112.071 }));
      registerStore(makeStore({ id: 's3', name: 'Mid', lat: 33.47, lng: -112.08 }));

      const results = queryNearbyStores(33.45, -112.07, 50);
      expect(results.length).toBe(3);
      expect(results[0].distance_miles).toBeLessThanOrEqual(results[1].distance_miles);
      expect(results[1].distance_miles).toBeLessThanOrEqual(results[2].distance_miles);
    });

    it('filters by store type', () => {
      registerStore(makeStore({ id: 'grocery', store_type: 'grocery' }));
      registerStore(makeStore({ id: 'clothing', store_type: 'clothing' }));

      const results = queryNearbyStores(33.45, -112.07, 50, 'grocery');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('grocery');
    });

    it('excludes inactive stores', () => {
      registerStore(makeStore({ id: 'active', is_active: true }));
      registerStore(makeStore({ id: 'inactive', is_active: false }));

      const results = queryNearbyStores(33.45, -112.07, 50);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('active');
    });

    it('includes distance_miles in results', () => {
      registerStore(makeStore({ id: 's1', lat: 33.46, lng: -112.08 }));
      const results = queryNearbyStores(33.45, -112.07, 50);
      expect(results[0].distance_miles).toBeGreaterThan(0);
      expect(typeof results[0].distance_miles).toBe('number');
    });

    it('returns empty for no stores within radius', () => {
      registerStore(makeStore({ id: 'far', lat: 40.0, lng: -100.0 }));
      const results = queryNearbyStores(33.45, -112.07, 5);
      expect(results).toHaveLength(0);
    });

    it('uses default 25-mile radius', () => {
      registerStore(makeStore({ id: 'nearby', lat: 33.55, lng: -112.10 })); // ~7 miles
      registerStore(makeStore({ id: 'farish', lat: 34.0, lng: -112.5 }));   // ~45 miles

      const results = queryNearbyStores(33.45, -112.07);
      expect(results.some(r => r.id === 'nearby')).toBe(true);
      expect(results.some(r => r.id === 'farish')).toBe(false);
    });
  });

  describe('distanceToStore', () => {
    it('returns distance to a specific store', () => {
      registerStore(makeStore({ id: 'target', lat: 33.50, lng: -112.10 }));
      const result = distanceToStore(33.45, -112.07, 'target');
      expect(result).not.toBeNull();
      expect(result!.distance_miles).toBeGreaterThan(0);
      expect(result!.store.id).toBe('target');
    });

    it('returns null for unknown store', () => {
      expect(distanceToStore(33.45, -112.07, 'nonexistent')).toBeNull();
    });
  });

  describe('getStore', () => {
    it('retrieves a registered store', () => {
      registerStore(makeStore({ id: 'test-store', name: 'My Store' }));
      const store = getStore('test-store');
      expect(store).not.toBeNull();
      expect(store!.name).toBe('My Store');
    });

    it('returns null for unknown store', () => {
      expect(getStore('unknown')).toBeNull();
    });
  });
});
