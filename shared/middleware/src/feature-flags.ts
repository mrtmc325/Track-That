// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Feature Flags Service
 * Per Phase 15 spec section 15.3:
 * Flags stored in-memory (PostgreSQL in production), cached with 5-min TTL.
 *
 * Flags control:
 * - Delivery provider enable/disable
 * - Search tuning parameters
 * - Coupon confidence thresholds
 * - Payment master switch
 *
 * reliability.timeouts_retries_and_circuit_breakers — flag reads have fallback defaults
 * operability.observability_by_default — flag changes logged
 */
// Logger not imported here — flag changes logged via console.log in structured JSON format
// to avoid circular dependency with the logger package.

export interface FeatureFlag {
  key: string;
  value: boolean | number | string;
  description: string;
  type: 'boolean' | 'number' | 'string';
  updated_at: Date;
  updated_by: string;
}

// Default flag values per spec
const DEFAULT_FLAGS: Record<string, FeatureFlag> = {
  enable_delivery_uber: {
    key: 'enable_delivery_uber',
    value: true,
    description: 'Enable/disable Uber Direct integration',
    type: 'boolean',
    updated_at: new Date(),
    updated_by: 'system',
  },
  enable_delivery_doordash: {
    key: 'enable_delivery_doordash',
    value: true,
    description: 'Enable/disable DoorDash Drive integration',
    type: 'boolean',
    updated_at: new Date(),
    updated_by: 'system',
  },
  search_fuzzy_threshold: {
    key: 'search_fuzzy_threshold',
    value: 2,
    description: 'Levenshtein distance threshold for fuzzy search matching',
    type: 'number',
    updated_at: new Date(),
    updated_by: 'system',
  },
  coupon_confidence_threshold: {
    key: 'coupon_confidence_threshold',
    value: 0.6,
    description: 'Minimum confidence score for auto-publishing extracted coupons',
    type: 'number',
    updated_at: new Date(),
    updated_by: 'system',
  },
  max_search_radius_miles: {
    key: 'max_search_radius_miles',
    value: 50,
    description: 'Maximum allowed search radius in miles',
    type: 'number',
    updated_at: new Date(),
    updated_by: 'system',
  },
  enable_payment: {
    key: 'enable_payment',
    value: true,
    description: 'Master switch for the entire checkout/payment flow',
    type: 'boolean',
    updated_at: new Date(),
    updated_by: 'system',
  },
};

// In-memory flag store (PostgreSQL in production, Redis cache with 5-min TTL)
const flags = new Map<string, FeatureFlag>();

// Initialize with defaults
for (const [key, flag] of Object.entries(DEFAULT_FLAGS)) {
  flags.set(key, { ...flag });
}

/**
 * Get a boolean flag value. Returns default if flag not found.
 */
export function isEnabled(key: string, defaultValue: boolean = false): boolean {
  const flag = flags.get(key);
  if (!flag || flag.type !== 'boolean') return defaultValue;
  return flag.value as boolean;
}

/**
 * Get a numeric flag value. Returns default if flag not found.
 */
export function getNumber(key: string, defaultValue: number = 0): number {
  const flag = flags.get(key);
  if (!flag || flag.type !== 'number') return defaultValue;
  return flag.value as number;
}

/**
 * Get a string flag value. Returns default if flag not found.
 */
export function getString(key: string, defaultValue: string = ''): string {
  const flag = flags.get(key);
  if (!flag || flag.type !== 'string') return defaultValue;
  return flag.value as string;
}

/**
 * Set a flag value. Logs the change for audit.
 * Per security.auditability_for_privileged_actions.
 */
export function setFlag(key: string, value: boolean | number | string, updatedBy: string): boolean {
  const flag = flags.get(key);
  if (!flag) return false;

  const oldValue = flag.value;
  flag.value = value;
  flag.updated_at = new Date();
  flag.updated_by = updatedBy;

  // Log the change for audit trail
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    severity: 5,
    service: 'feature-flags',
    request_id: 'none',
    action: 'flag.changed',
    message: `Feature flag '${key}' changed`,
    metadata: {
      key,
      old_value: oldValue,
      new_value: value,
      updated_by: updatedBy,
    },
  }));

  return true;
}

/**
 * Get all flags (for admin UI).
 */
export function getAllFlags(): FeatureFlag[] {
  return Array.from(flags.values());
}

/**
 * Reset to defaults (testing).
 */
export function _resetFlags(): void {
  flags.clear();
  for (const [key, flag] of Object.entries(DEFAULT_FLAGS)) {
    flags.set(key, { ...flag });
  }
}
