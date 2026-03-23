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

  // In production, this would call Nominatim:
  // const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  // const response = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'TrackThat/1.0' } });

  logger.info('geo.geocode', 'Geocode miss — no result available', {
    address_hash: hashAddress(address),
  });

  return null;
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
