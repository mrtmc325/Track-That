// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Adapter Plugin Interface
 * Per Phase 4 spec: all adapter types implement this common contract.
 * Each adapter extracts raw product data from a different source type.
 *
 * quality.inline_documentation_for_non_obvious_logic — interface documented
 */

export interface RawProduct {
  /** Product name as found on source (before normalization) */
  raw_name: string;
  /** Price as string or number (will be normalized) */
  raw_price: string | number;
  /** Original/regular price if on sale */
  original_price?: string | number;
  /** Whether item is currently on sale */
  on_sale?: boolean;
  /** Source URL where this listing was found */
  source_url: string;
  /** Brand if detectable */
  brand?: string;
  /** Category if detectable */
  category?: string;
  /** Image URL if available */
  image_url?: string;
  /** Description text */
  description?: string;
  /** Unit of measure (e.g., "per lb", "16 oz") */
  unit_of_measure?: string;
}

export interface AdapterResult {
  success: boolean;
  products: RawProduct[];
  errors: string[];
  /** Time taken to extract in ms */
  extraction_time_ms: number;
  /** Source identifier for audit */
  source: string;
}

export type AdapterType = 'web_scraper' | 'api' | 'feed' | 'csv' | 'manual';

/**
 * All adapter plugins must implement this interface.
 * security.validate_all_untrusted_input — adapters treat all external data as untrusted.
 */
export interface VendorAdapter {
  readonly type: AdapterType;

  /**
   * Extract products from the configured source.
   * @param config - Adapter-specific configuration (URLs, selectors, API keys, etc.)
   * @returns AdapterResult with extracted products or errors
   */
  extract(config: Record<string, unknown>): Promise<AdapterResult>;

  /**
   * Validate adapter configuration before use.
   * @returns true if config is valid, string error message otherwise
   */
  validateConfig(config: Record<string, unknown>): string | true;
}
