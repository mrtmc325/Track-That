// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

// ---------------------------------------------------------------------------
// Application-wide constants
// ---------------------------------------------------------------------------

/** Base URL for all API calls. The Vite dev proxy rewrites /api → gateway. */
export const API_BASE_URL = '/api/v1';

/** Product / store category identifiers used across the app. */
export enum CATEGORIES {
  GROCERY = 'GROCERY',
  CLOTHING = 'CLOTHING',
  DEPARTMENT = 'DEPARTMENT',
  SPECIALTY = 'SPECIALTY',
  PHARMACY = 'PHARMACY',
  CONVENIENCE = 'CONVENIENCE',
}

/** Human-readable labels for each category. */
export const CATEGORY_LABELS: Record<CATEGORIES, string> = {
  [CATEGORIES.GROCERY]: 'Grocery',
  [CATEGORIES.CLOTHING]: 'Clothing',
  [CATEGORIES.DEPARTMENT]: 'Department',
  [CATEGORIES.SPECIALTY]: 'Specialty',
  [CATEGORIES.PHARMACY]: 'Pharmacy',
  [CATEGORIES.CONVENIENCE]: 'Convenience',
};

/**
 * Default map center — Phoenix, AZ (downtown).
 * [latitude, longitude] as expected by Leaflet / react-leaflet.
 */
export const MAP_DEFAULT_CENTER: [number, number] = [33.4484, -112.074];

/** Default zoom level for the store-finder map. */
export const MAP_DEFAULT_ZOOM = 12;
