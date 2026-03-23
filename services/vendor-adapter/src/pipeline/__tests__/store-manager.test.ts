import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerStore,
  transitionStore,
  configureAdapter,
  recordScrapeSuccess,
  getStore,
  listStores,
  _resetStores,
} from '../store-manager.js';

const STORE_INPUT = {
  name: 'FreshMart Phoenix',
  address: '123 Main St',
  city: 'Phoenix',
  state: 'AZ',
  zip: '85001',
  location: { lat: 33.45, lng: -112.07 },
  website_url: 'https://freshmart.example.com',
  store_type: 'grocery' as const,
};

describe('Store Manager', () => {
  beforeEach(() => {
    _resetStores();
  });

  describe('registerStore', () => {
    it('creates store in discovered state', () => {
      const store = registerStore(STORE_INPUT);
      expect(store.id).toBeDefined();
      expect(store.name).toBe('FreshMart Phoenix');
      expect(store.status).toBe('discovered');
      expect(store.is_active).toBe(false);
      expect(store.slug).toBe('freshmart-phoenix');
    });

    it('generates a URL-safe slug', () => {
      const store = registerStore({ ...STORE_INPUT, name: "Joe's Market & Deli" });
      expect(store.slug).toBe('joe-s-market-deli');
    });

    it('sets default values', () => {
      const store = registerStore(STORE_INPUT);
      expect(store.adapter_type).toBe('manual');
      expect(store.scrape_frequency_minutes).toBe(60);
      expect(store.product_count).toBe(0);
      expect(store.avg_rating).toBe(0);
    });
  });

  describe('State Machine Transitions', () => {
    it('discovered → adapter_configured', () => {
      const store = registerStore(STORE_INPUT);
      const result = transitionStore(store.id, 'adapter_configured');
      expect('error' in result).toBe(false);
      if (!('error' in result)) expect(result.status).toBe('adapter_configured');
    });

    it('adapter_configured → test_scrape', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      const result = transitionStore(store.id, 'test_scrape');
      if (!('error' in result)) expect(result.status).toBe('test_scrape');
    });

    it('test_scrape → validated', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      const result = transitionStore(store.id, 'validated');
      if (!('error' in result)) expect(result.status).toBe('validated');
    });

    it('test_scrape → adapter_configured (fix config)', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      const result = transitionStore(store.id, 'adapter_configured');
      if (!('error' in result)) expect(result.status).toBe('adapter_configured');
    });

    it('validated → active', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      transitionStore(store.id, 'validated');
      const result = transitionStore(store.id, 'active');
      if (!('error' in result)) {
        expect(result.status).toBe('active');
        expect(result.is_active).toBe(true);
      }
    });

    it('active → paused', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      transitionStore(store.id, 'validated');
      transitionStore(store.id, 'active');
      const result = transitionStore(store.id, 'paused');
      if (!('error' in result)) {
        expect(result.status).toBe('paused');
        expect(result.is_active).toBe(false);
      }
    });

    it('paused → active (re-enable)', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      transitionStore(store.id, 'validated');
      transitionStore(store.id, 'active');
      transitionStore(store.id, 'paused');
      const result = transitionStore(store.id, 'active');
      if (!('error' in result)) expect(result.is_active).toBe(true);
    });

    it('rejects invalid transition (discovered → active)', () => {
      const store = registerStore(STORE_INPUT);
      const result = transitionStore(store.id, 'active');
      expect('error' in result).toBe(true);
      if ('error' in result) expect(result.error).toContain('Cannot transition');
    });

    it('rejects transition from inactive (terminal)', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      transitionStore(store.id, 'validated');
      transitionStore(store.id, 'active');
      transitionStore(store.id, 'inactive');
      const result = transitionStore(store.id, 'active');
      expect('error' in result).toBe(true);
    });

    it('returns error for unknown store', () => {
      const result = transitionStore('nonexistent', 'active');
      expect('error' in result).toBe(true);
    });
  });

  describe('configureAdapter', () => {
    it('configures adapter in discovered state', () => {
      const store = registerStore(STORE_INPUT);
      const result = configureAdapter(store.id, 'csv', { source_url: 'https://example.com/feed.csv' }, 30);
      if (!('error' in result)) {
        expect(result.adapter_type).toBe('csv');
        expect(result.scrape_frequency_minutes).toBe(30);
        expect(result.status).toBe('adapter_configured');
      }
    });

    it('rejects configuration in active state', () => {
      const store = registerStore(STORE_INPUT);
      transitionStore(store.id, 'adapter_configured');
      transitionStore(store.id, 'test_scrape');
      transitionStore(store.id, 'validated');
      transitionStore(store.id, 'active');
      const result = configureAdapter(store.id, 'api', {});
      expect('error' in result).toBe(true);
    });
  });

  describe('recordScrapeSuccess', () => {
    it('updates last_successful_scrape and product_count', () => {
      const store = registerStore(STORE_INPUT);
      recordScrapeSuccess(store.id, 42);
      const updated = getStore(store.id);
      expect(updated!.last_successful_scrape).not.toBeNull();
      expect(updated!.product_count).toBe(42);
    });
  });

  describe('listStores', () => {
    it('lists all stores', () => {
      registerStore(STORE_INPUT);
      registerStore({ ...STORE_INPUT, name: 'Store 2', store_type: 'clothing' });
      expect(listStores()).toHaveLength(2);
    });

    it('filters by status', () => {
      const s1 = registerStore(STORE_INPUT);
      registerStore({ ...STORE_INPUT, name: 'Store 2' });
      transitionStore(s1.id, 'adapter_configured');
      expect(listStores({ status: 'adapter_configured' })).toHaveLength(1);
    });

    it('filters by store type', () => {
      registerStore(STORE_INPUT);
      registerStore({ ...STORE_INPUT, name: 'Clothing Shop', store_type: 'clothing' });
      expect(listStores({ store_type: 'grocery' })).toHaveLength(1);
    });
  });
});
