// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Geocoding Service — abstracts forward/reverse geocoding.
 * In production: calls Nominatim (OpenStreetMap) via HTTPS.
 * For dev/testing: uses in-memory mock with configurable results.
 *
 * reliability.timeouts_retries_and_circuit_breakers — 5s timeout on external calls
 * security.encryption_in_transit_and_at_rest — HTTPS only to Nominatim
 * security.no_sensitive_data_in_logs — user addresses hashed before logging
 */
import crypto from 'node:crypto';
import { logger } from '../utils/logger.js';

export interface GeocodingResult {
  lat: number;
  lng: number;
  display_name: string;
  confidence: number; // 0.0-1.0
}

export interface ReverseGeocodingResult {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

// Built-in US ZIP code → lat/lng lookup for reliable geocoding
// Covers major metro areas. Falls back to Nominatim for unlisted ZIPs.
const ZIP_LOOKUP: Record<string, { lat: number; lng: number; city: string; state: string }> = {
  // Arizona
  '85001': { lat: 33.4484, lng: -112.0740, city: 'Phoenix', state: 'AZ' },
  '85003': { lat: 33.4510, lng: -112.0783, city: 'Phoenix', state: 'AZ' },
  '85004': { lat: 33.4556, lng: -112.0694, city: 'Phoenix', state: 'AZ' },
  '85006': { lat: 33.4615, lng: -112.0446, city: 'Phoenix', state: 'AZ' },
  '85008': { lat: 33.4687, lng: -112.0095, city: 'Phoenix', state: 'AZ' },
  '85014': { lat: 33.5079, lng: -112.0565, city: 'Phoenix', state: 'AZ' },
  '85015': { lat: 33.5100, lng: -112.0905, city: 'Phoenix', state: 'AZ' },
  '85016': { lat: 33.5095, lng: -112.0199, city: 'Phoenix', state: 'AZ' },
  '85018': { lat: 33.4960, lng: -111.9810, city: 'Phoenix', state: 'AZ' },
  '85032': { lat: 33.6200, lng: -111.9940, city: 'Phoenix', state: 'AZ' },
  '85051': { lat: 33.5678, lng: -112.1019, city: 'Phoenix', state: 'AZ' },
  '85085': { lat: 33.7130, lng: -112.0380, city: 'Phoenix', state: 'AZ' },
  '85251': { lat: 33.4945, lng: -111.9256, city: 'Scottsdale', state: 'AZ' },
  '85257': { lat: 33.4573, lng: -111.9180, city: 'Scottsdale', state: 'AZ' },
  '85281': { lat: 33.4241, lng: -111.9400, city: 'Tempe', state: 'AZ' },
  '85719': { lat: 32.2464, lng: -110.9471, city: 'Tucson', state: 'AZ' },
  // New York
  '10001': { lat: 40.7484, lng: -73.9967, city: 'New York', state: 'NY' },
  '10002': { lat: 40.7157, lng: -73.9863, city: 'New York', state: 'NY' },
  '10003': { lat: 40.7317, lng: -73.9893, city: 'New York', state: 'NY' },
  '10012': { lat: 40.7258, lng: -73.9981, city: 'New York', state: 'NY' },
  '10021': { lat: 40.7694, lng: -73.9588, city: 'New York', state: 'NY' },
  '10036': { lat: 40.7590, lng: -73.9898, city: 'New York', state: 'NY' },
  '11201': { lat: 40.6934, lng: -73.9892, city: 'Brooklyn', state: 'NY' },
  // California
  '90001': { lat: 33.9425, lng: -118.2551, city: 'Los Angeles', state: 'CA' },
  '90012': { lat: 34.0624, lng: -118.2384, city: 'Los Angeles', state: 'CA' },
  '90038': { lat: 34.0907, lng: -118.3316, city: 'Los Angeles', state: 'CA' },
  '90210': { lat: 34.0901, lng: -118.4065, city: 'Beverly Hills', state: 'CA' },
  '91402': { lat: 34.2257, lng: -118.4489, city: 'Panorama City', state: 'CA' },
  '94102': { lat: 37.7816, lng: -122.4137, city: 'San Francisco', state: 'CA' },
  '94110': { lat: 37.7490, lng: -122.4154, city: 'San Francisco', state: 'CA' },
  // Texas
  '73301': { lat: 30.2672, lng: -97.7431, city: 'Austin', state: 'TX' },
  '75001': { lat: 32.9483, lng: -96.7299, city: 'Addison', state: 'TX' },
  '77001': { lat: 29.7604, lng: -95.3698, city: 'Houston', state: 'TX' },
  // Florida
  '33101': { lat: 25.7617, lng: -80.1918, city: 'Miami', state: 'FL' },
  '32801': { lat: 28.5383, lng: -81.3792, city: 'Orlando', state: 'FL' },
  // Illinois
  '60601': { lat: 41.8819, lng: -87.6278, city: 'Chicago', state: 'IL' },
  '60614': { lat: 41.9219, lng: -87.6521, city: 'Chicago', state: 'IL' },
  // Washington
  '98101': { lat: 47.6062, lng: -122.3321, city: 'Seattle', state: 'WA' },
  // Georgia
  '30301': { lat: 33.7490, lng: -84.3880, city: 'Atlanta', state: 'GA' },
  // Colorado
  '80201': { lat: 39.7392, lng: -104.9903, city: 'Denver', state: 'CO' },
  // Massachusetts
  '02101': { lat: 42.3601, lng: -71.0589, city: 'Boston', state: 'MA' },
};

// In-memory mock geocoding store for dev/testing
// Maps address strings to coordinates
const mockGeocodeResults = new Map<string, GeocodingResult>();
const mockReverseResults = new Map<string, ReverseGeocodingResult>();

// Distance cache keyed by geohash pairs
const distanceCache = new Map<string, { distance: number; expires: number }>();
const DISTANCE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours per spec

/**
 * Forward geocode: address/zip to lat/lng.
 * In production, calls Nominatim with 5s timeout.
 * In dev mode, returns mock result if available.
 */
export async function geocode(address: string): Promise<GeocodingResult | null> {
  if (!address || address.trim().length < 2) {
    return null;
  }

  const normalized = address.trim().toLowerCase();

  // Check mock store first (dev/test mode)
  const mockResult = mockGeocodeResults.get(normalized);
  if (mockResult) {
    logger.debug('geo.geocode', 'Geocode resolved (mock)', {
      address_hash: hashAddress(address),
    });
    return mockResult;
  }

  // Call Nominatim (OpenStreetMap) for real geocoding
  try {
    // For US ZIP codes, check built-in lookup first (Nominatim is unreliable for ZIP-only queries)
    const isZip = /^\d{5}$/.test(address.trim());
    if (isZip) {
      const zipResult = ZIP_LOOKUP[address.trim()];
      if (zipResult) {
        const result: GeocodingResult = { lat: zipResult.lat, lng: zipResult.lng, display_name: `${zipResult.city}, ${zipResult.state} ${address.trim()}`, confidence: 1.0 };
        mockGeocodeResults.set(normalized, result);
        logger.info('geo.geocode', 'ZIP resolved via built-in lookup', { address_hash: hashAddress(address), display_name: result.display_name });
        return result;
      }
    }

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + (isZip ? ', United States' : ''))}&format=json&limit=1`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'TrackThat/1.0 (+https://trackhat.local)' },
    });

    if (!response.ok) {
      logger.warning('geo.geocode', `Nominatim returned ${response.status}`, { address_hash: hashAddress(address) });
      return null;
    }

    const data = await response.json() as { lat: string; lon: string; display_name: string }[];
    if (data.length === 0) {
      logger.info('geo.geocode', 'Nominatim returned no results', { address_hash: hashAddress(address) });
      return null;
    }

    const result: GeocodingResult = {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      display_name: data[0].display_name,
      confidence: 0.9,
    };

    // Cache the result for future lookups
    mockGeocodeResults.set(normalized, result);

    logger.info('geo.geocode', 'Geocode resolved via Nominatim', {
      address_hash: hashAddress(address),
      display_name: result.display_name.substring(0, 50),
    });

    return result;
  } catch (err) {
    logger.error('geo.geocode', `Nominatim error: ${(err as Error).message}`, { address_hash: hashAddress(address) });
    return null;
  }
}

/**
 * Reverse geocode: lat/lng to address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodingResult | null> {
  // Round to 4 decimal places for cache key (~11m precision)
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  const mockResult = mockReverseResults.get(key);
  if (mockResult) {
    logger.debug('geo.reverse', 'Reverse geocode resolved (mock)', {
      lat: lat.toFixed(4),
      lng: lng.toFixed(4),
    });
    return mockResult;
  }

  // In production: call Nominatim reverse endpoint
  logger.info('geo.reverse', 'Reverse geocode miss', {
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
  });

  return null;
}

/**
 * Get cached distance between two geohash-bucketed points.
 * Returns null if not cached.
 */
export function getCachedDistance(geohash1: string, geohash2: string): number | null {
  const key = geohash1 < geohash2 ? `${geohash1}:${geohash2}` : `${geohash2}:${geohash1}`;
  const cached = distanceCache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.distance;
  }
  if (cached) distanceCache.delete(key); // Expired
  return null;
}

/**
 * Cache a distance between two geohash-bucketed points.
 */
export function cacheDistance(geohash1: string, geohash2: string, distance: number): void {
  const key = geohash1 < geohash2 ? `${geohash1}:${geohash2}` : `${geohash2}:${geohash1}`;
  distanceCache.set(key, { distance, expires: Date.now() + DISTANCE_CACHE_TTL_MS });
}

/**
 * Hash an address for logging — never log raw user addresses.
 * Per security.no_sensitive_data_in_logs.
 */
function hashAddress(address: string): string {
  return crypto.createHash('sha256').update(address).digest('hex').substring(0, 8);
}

/** Add mock geocode result (testing) */
export function addMockGeocode(address: string, result: GeocodingResult): void {
  mockGeocodeResults.set(address.trim().toLowerCase(), result);
}

/** Add mock reverse geocode result (testing) */
export function addMockReverse(lat: number, lng: number, result: ReverseGeocodingResult): void {
  mockReverseResults.set(`${lat.toFixed(4)},${lng.toFixed(4)}`, result);
}

/** Clear all mocks and caches (testing) */
export function _resetAll(): void {
  mockGeocodeResults.clear();
  mockReverseResults.clear();
  distanceCache.clear();
}
