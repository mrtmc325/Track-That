// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Coupon Store — manages the coupon inventory and flyer data.
 * In production: PostgreSQL promotions.* schema.
 * For dev: in-memory store.
 *
 * operability.observability_by_default — logs ingestion metrics
 */
import crypto from 'node:crypto';
import type { CouponExtraction, SourceType } from './extraction.service.js';
import { logger } from '../utils/logger.js';

export interface StoredCoupon extends CouponExtraction {
  id: string;
  created_at: Date;
  is_active: boolean;
}

export interface FlyerRecord {
  id: string;
  store_id: string;
  source_url: string;
  title: string;
  valid_from: Date;
  valid_until: Date;
  coupon_count: number;
  last_ingested: Date;
}

// In-memory stores
const coupons = new Map<string, StoredCoupon>();
const flyers = new Map<string, FlyerRecord>();

/**
 * Store a validated coupon.
 */
export function storeCoupon(extraction: CouponExtraction): StoredCoupon {
  const id = crypto.randomUUID();
  const stored: StoredCoupon = {
    ...extraction,
    id,
    created_at: new Date(),
    is_active: true,
  };
  coupons.set(id, stored);
  return stored;
}

/**
 * Query active coupons with optional filters.
 */
export function queryCoupons(filters: {
  store_id?: string;
  product_id?: string;
  category?: string;
  active_only?: boolean;
}): StoredCoupon[] {
  const now = new Date();
  let results = Array.from(coupons.values());

  if (filters.active_only !== false) {
    results = results.filter(c => c.is_active && c.valid_until >= now && c.valid_from <= now);
  }
  if (filters.store_id) {
    results = results.filter(c => c.store_id === filters.store_id);
  }
  if (filters.product_id) {
    results = results.filter(c =>
      c.applicable_products.length === 0 || c.applicable_products.includes(filters.product_id!),
    );
  }
  if (filters.category) {
    results = results.filter(c =>
      c.applicable_categories.length === 0 || c.applicable_categories.includes(filters.category!),
    );
  }

  return results.sort((a, b) => b.discount_value - a.discount_value);
}

/**
 * Expire coupons past their valid_until date.
 */
export function expireCoupons(): number {
  const now = new Date();
  let count = 0;
  for (const coupon of coupons.values()) {
    if (coupon.is_active && coupon.valid_until < now) {
      coupon.is_active = false;
      count++;
    }
  }
  if (count > 0) {
    logger.info('coupon-store.expired', `Auto-expired ${count} coupons`, { count });
  }
  return count;
}

/**
 * Store or update a flyer record.
 */
export function storeFlyer(flyer: Omit<FlyerRecord, 'id' | 'last_ingested'>): FlyerRecord {
  // Check for existing flyer from same store+url
  for (const existing of flyers.values()) {
    if (existing.store_id === flyer.store_id && existing.source_url === flyer.source_url) {
      existing.valid_from = flyer.valid_from;
      existing.valid_until = flyer.valid_until;
      existing.coupon_count = flyer.coupon_count;
      existing.last_ingested = new Date();
      return existing;
    }
  }

  const id = crypto.randomUUID();
  const record: FlyerRecord = { ...flyer, id, last_ingested: new Date() };
  flyers.set(id, record);
  return record;
}

/**
 * Get current flyer for a store (most recently ingested, still valid).
 */
export function getCurrentFlyer(storeId: string): FlyerRecord | null {
  const now = new Date();
  const storeFlyers = Array.from(flyers.values())
    .filter(f => f.store_id === storeId && f.valid_until >= now)
    .sort((a, b) => b.last_ingested.getTime() - a.last_ingested.getTime());
  return storeFlyers[0] || null;
}

/**
 * Get today's best deals (coupons with highest discount, optionally filtered).
 */
export function getTodayDeals(limit: number = 20): StoredCoupon[] {
  return queryCoupons({ active_only: true }).slice(0, limit);
}

/** Get coupon count */
export function getCouponCount(): { active: number; total: number } {
  const now = new Date();
  const active = Array.from(coupons.values()).filter(c => c.is_active && c.valid_until >= now).length;
  return { active, total: coupons.size };
}

/** Clear (testing) */
export function _resetStore(): void {
  coupons.clear();
  flyers.clear();
}
