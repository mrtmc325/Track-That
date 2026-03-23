/**
 * Store Manager — manages store lifecycle and onboarding state machine.
 * Per Phase 4 spec section 4.3: Discovered → AdapterConfigured → TestScrape →
 * Validated → Active → Paused/Inactive
 *
 * governance.architecture_decisions_are_recorded — state machine documented
 */
import { logger } from '../utils/logger.js';

export type StoreStatus = 'discovered' | 'adapter_configured' | 'test_scrape' | 'validated' | 'active' | 'paused' | 'inactive';
export type StoreType = 'grocery' | 'clothing' | 'department' | 'specialty' | 'pharmacy' | 'convenience';
export type AdapterType = 'web_scraper' | 'api' | 'feed' | 'csv' | 'manual';

export interface Store {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  location: { lat: number; lng: number };
  phone: string;
  website_url: string;
  store_type: StoreType;
  adapter_type: AdapterType;
  /** Adapter config — encrypted at rest in production per security.encryption_in_transit_and_at_rest */
  adapter_config: Record<string, unknown>;
  scrape_frequency_minutes: number;
  status: StoreStatus;
  is_active: boolean;
  last_successful_scrape: Date | null;
  product_count: number;
  avg_rating: number;
  created_at: Date;
  updated_at: Date;
}

/** Valid state transitions per the onboarding state machine */
const VALID_TRANSITIONS: Record<StoreStatus, StoreStatus[]> = {
  discovered: ['adapter_configured'],
  adapter_configured: ['test_scrape'],
  test_scrape: ['validated', 'adapter_configured'], // Can go back to fix config
  validated: ['active'],
  active: ['paused', 'inactive'],
  paused: ['active', 'inactive'],
  inactive: [], // Terminal state
};

// In-memory store registry (replaced by PostgreSQL in production)
const stores = new Map<string, Store>();

/**
 * Register a new store (starts in 'discovered' state).
 */
export function registerStore(input: {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  location: { lat: number; lng: number };
  phone?: string;
  website_url: string;
  store_type: StoreType;
}): Store {
  const id = crypto.randomUUID();
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const store: Store = {
    id,
    name: input.name,
    slug,
    address: input.address,
    city: input.city,
    state: input.state,
    zip: input.zip,
    location: input.location,
    phone: input.phone || '',
    website_url: input.website_url,
    store_type: input.store_type,
    adapter_type: 'manual',
    adapter_config: {},
    scrape_frequency_minutes: 60,
    status: 'discovered',
    is_active: false,
    last_successful_scrape: null,
    product_count: 0,
    avg_rating: 0,
    created_at: new Date(),
    updated_at: new Date(),
  };

  stores.set(id, store);
  logger.notice('store.registered', 'New store registered', { store_id: id, name: input.name });
  return store;
}

/**
 * Transition a store to a new status.
 * Enforces valid state transitions per the onboarding state machine.
 */
export function transitionStore(storeId: string, newStatus: StoreStatus): Store | { error: string } {
  const store = stores.get(storeId);
  if (!store) return { error: 'Store not found' };

  const allowed = VALID_TRANSITIONS[store.status];
  if (!allowed.includes(newStatus)) {
    return { error: `Cannot transition from '${store.status}' to '${newStatus}'. Allowed: ${allowed.join(', ') || 'none'}` };
  }

  const oldStatus = store.status;
  store.status = newStatus;
  store.is_active = newStatus === 'active';
  store.updated_at = new Date();

  logger.notice('store.transition', `Store status changed: ${oldStatus} → ${newStatus}`, {
    store_id: storeId,
    from: oldStatus,
    to: newStatus,
  });

  return store;
}

/**
 * Configure adapter for a store.
 * Only allowed when store is in 'discovered' or 'adapter_configured' state.
 */
export function configureAdapter(
  storeId: string,
  adapterType: AdapterType,
  config: Record<string, unknown>,
  scrapeFrequencyMinutes?: number,
): Store | { error: string } {
  const store = stores.get(storeId);
  if (!store) return { error: 'Store not found' };

  if (store.status !== 'discovered' && store.status !== 'adapter_configured') {
    return { error: `Cannot configure adapter in '${store.status}' state` };
  }

  store.adapter_type = adapterType;
  store.adapter_config = config;
  if (scrapeFrequencyMinutes) store.scrape_frequency_minutes = scrapeFrequencyMinutes;
  store.status = 'adapter_configured';
  store.updated_at = new Date();

  logger.info('store.adapter_configured', 'Adapter configured', {
    store_id: storeId,
    adapter_type: adapterType,
  });

  return store;
}

/**
 * Record a successful scrape for a store.
 */
export function recordScrapeSuccess(storeId: string, productCount: number): void {
  const store = stores.get(storeId);
  if (!store) return;

  store.last_successful_scrape = new Date();
  store.product_count = productCount;
  store.updated_at = new Date();
}

/** Get store by ID */
export function getStore(id: string): Store | null {
  return stores.get(id) || null;
}

/** List all stores, optionally filtered by status */
export function listStores(filter?: { status?: StoreStatus; store_type?: StoreType }): Store[] {
  let result = Array.from(stores.values());
  if (filter?.status) result = result.filter(s => s.status === filter.status);
  if (filter?.store_type) result = result.filter(s => s.store_type === filter.store_type);
  return result;
}

/** Clear stores (testing) */
export function _resetStores(): void {
  stores.clear();
}
