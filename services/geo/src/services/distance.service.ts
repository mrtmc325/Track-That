// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Haversine distance calculation for store proximity.
 * Per scalability.performance_budgets_as_contracts — pure math, < 0.1ms per call.
 *
 * Returns straight-line distance in miles between two lat/lng points.
 * Accuracy: sufficient for local search (within a metro area).
 * Enhancement path: OSRM for actual driving/walking distance.
 */

const EARTH_RADIUS_MILES = 3958.8;

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * @returns Distance in miles
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (deg: number) => deg * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Filter stores within a given radius from a point.
 */
export interface StoreLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface StoreWithDistance extends StoreLocation {
  distance_miles: number;
}

export function findStoresWithinRadius(
  userLat: number,
  userLng: number,
  stores: StoreLocation[],
  radiusMiles: number,
): StoreWithDistance[] {
  return stores
    .map(store => ({
      ...store,
      distance_miles: Math.round(haversineDistance(userLat, userLng, store.lat, store.lng) * 100) / 100,
    }))
    .filter(store => store.distance_miles <= radiusMiles)
    .sort((a, b) => a.distance_miles - b.distance_miles);
}

/**
 * Encode a lat/lng to a geohash string for cache bucketing.
 * Precision 5 = ~4.9km x 4.9km grid per plan spec.
 */
export function encodeGeohash(lat: number, lng: number, precision: number = 5): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '';
  let isLng = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch |= (1 << (4 - bit)); minLng = mid; }
      else { maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch |= (1 << (4 - bit)); minLat = mid; }
      else { maxLat = mid; }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
