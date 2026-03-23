// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { haversineDistance, findStoresWithinRadius, encodeGeohash } from '../distance.service.js';

describe('Haversine Distance', () => {
  it('returns 0 for same point', () => {
    expect(haversineDistance(33.45, -112.07, 33.45, -112.07)).toBe(0);
  });

  it('calculates known distance between Phoenix and Tucson', () => {
    // Phoenix to Tucson is ~108 miles straight line
    const dist = haversineDistance(33.4484, -112.0740, 32.2226, -110.9747);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it('calculates short distances accurately', () => {
    // Two points ~1 mile apart in Phoenix
    const dist = haversineDistance(33.4484, -112.0740, 33.4629, -112.0740);
    expect(dist).toBeGreaterThan(0.9);
    expect(dist).toBeLessThan(1.1);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(33.45, -112.07, 34.05, -111.09);
    const d2 = haversineDistance(34.05, -111.09, 33.45, -112.07);
    expect(d1).toBeCloseTo(d2, 10);
  });
});

describe('findStoresWithinRadius', () => {
  const stores = [
    { id: 's1', name: 'Near Store', lat: 33.449, lng: -112.074 },
    { id: 's2', name: 'Mid Store', lat: 33.50, lng: -112.10 },
    { id: 's3', name: 'Far Store', lat: 34.00, lng: -112.50 },
  ];

  it('filters stores outside radius', () => {
    const result = findStoresWithinRadius(33.448, -112.074, stores, 5);
    expect(result.length).toBeLessThan(stores.length);
    expect(result.every(s => s.distance_miles <= 5)).toBe(true);
  });

  it('returns stores sorted by distance', () => {
    const result = findStoresWithinRadius(33.448, -112.074, stores, 100);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance_miles).toBeGreaterThanOrEqual(result[i - 1].distance_miles);
    }
  });

  it('includes distance_miles on each result', () => {
    const result = findStoresWithinRadius(33.448, -112.074, stores, 100);
    result.forEach(s => expect(typeof s.distance_miles).toBe('number'));
  });

  it('returns empty array when no stores in radius', () => {
    const result = findStoresWithinRadius(33.448, -112.074, stores, 0.001);
    expect(result).toEqual([]);
  });
});

describe('encodeGeohash', () => {
  it('encodes Phoenix coordinates', () => {
    const hash = encodeGeohash(33.4484, -112.0740);
    expect(hash.length).toBe(5);
    expect(typeof hash).toBe('string');
  });

  it('nearby points produce same geohash at precision 5', () => {
    // Two points ~100m apart should have same geohash at precision 5 (~4.9km grid)
    const h1 = encodeGeohash(33.4484, -112.0740);
    const h2 = encodeGeohash(33.4485, -112.0741);
    expect(h1).toBe(h2);
  });

  it('distant points produce different geohashes', () => {
    const h1 = encodeGeohash(33.45, -112.07); // Phoenix
    const h2 = encodeGeohash(40.71, -74.00);  // New York
    expect(h1).not.toBe(h2);
  });

  it('respects precision parameter', () => {
    const h3 = encodeGeohash(33.45, -112.07, 3);
    const h7 = encodeGeohash(33.45, -112.07, 7);
    expect(h3.length).toBe(3);
    expect(h7.length).toBe(7);
    expect(h7.startsWith(h3)).toBe(true);
  });
});
