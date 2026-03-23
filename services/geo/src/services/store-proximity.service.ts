// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Store Proximity Service — manages store registry and proximity queries.
 * Combines distance calculation with store data for the geo API.
 *
 * operability.observability_by_default — logs proximity queries
 */
import { haversineDistance, findStoresWithinRadius, encodeGeohash, type StoreWithDistance } from './distance.service.js';
import { getCachedDistance, cacheDistance } from './geocoding.service.js';
import { logger } from '../utils/logger.js';

export type StoreType = 'grocery' | 'clothing' | 'department' | 'specialty' | 'pharmacy' | 'convenience';

export interface GeoStore {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  store_type: StoreType;
  is_active: boolean;
  avg_rating: number;
  product_count: number;
}

export interface ProximityResult extends GeoStore {
  distance_miles: number;
}

// In-memory store registry (PostgreSQL in production)
const stores = new Map<string, GeoStore>();

/**
 * Query stores within a radius, optionally filtered by type.
 * Uses geohash-bucketed distance cache when available.
 */
export function queryNearbyStores(
  lat: number,
  lng: number,
  radiusMiles: number = 25,
  storeType?: StoreType,
): ProximityResult[] {
  const userGeohash = encodeGeohash(lat, lng);
  const results: ProximityResult[] = [];

  for (const store of stores.values()) {
    if (!store.is_active) continue;
    if (storeType && store.store_type !== storeType) continue;

    // Check geohash distance cache first
    const storeGeohash = encodeGeohash(store.lat, store.lng);
    let distance = getCachedDistance(userGeohash, storeGeohash);

    if (distance === null) {
      distance = Math.round(haversineDistance(lat, lng, store.lat, store.lng) * 100) / 100;
      cacheDistance(userGeohash, storeGeohash, distance);
    }

    if (distance <= radiusMiles) {
      results.push({ ...store, distance_miles: distance });
    }
  }

  // Sort by distance ascending
  results.sort((a, b) => a.distance_miles - b.distance_miles);

  logger.info('geo.proximity', 'Proximity query completed', {
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
    radius: radiusMiles,
    results_count: results.length,
    store_type: storeType || 'all',
  });

  return results;
}

/**
 * Get distance to a specific store from user location.
 */
export function distanceToStore(
  fromLat: number,
  fromLng: number,
  storeId: string,
): { store: GeoStore; distance_miles: number } | null {
  const store = stores.get(storeId);
  if (!store) return null;

  const distance = Math.round(haversineDistance(fromLat, fromLng, store.lat, store.lng) * 100) / 100;
  return { store, distance_miles: distance };
}

/** Register a store */
export function registerStore(store: GeoStore): void {
  stores.set(store.id, store);
}

/** Get store by ID */
export function getStore(id: string): GeoStore | null {
  return stores.get(id) || null;
}

/** Clear stores (testing) */
export function _resetStores(): void {
  stores.clear();
}
