// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect, beforeEach } from 'vitest';
import { isEnabled, getNumber, getString, setFlag, getAllFlags, _resetFlags } from '../feature-flags.js';

describe('Feature Flags Service (Phase 15 Section 15.3)', () => {
  beforeEach(() => { _resetFlags(); });

  describe('isEnabled', () => {
    it('returns true for enabled delivery providers by default', () => {
      expect(isEnabled('enable_delivery_uber')).toBe(true);
      expect(isEnabled('enable_delivery_doordash')).toBe(true);
    });

    it('returns true for payment enabled by default', () => {
      expect(isEnabled('enable_payment')).toBe(true);
    });

    it('returns default value for unknown flags', () => {
      expect(isEnabled('nonexistent_flag')).toBe(false);
      expect(isEnabled('nonexistent_flag', true)).toBe(true);
    });
  });

  describe('getNumber', () => {
    it('returns fuzzy threshold default of 2', () => {
      expect(getNumber('search_fuzzy_threshold')).toBe(2);
    });

    it('returns coupon confidence threshold of 0.6', () => {
      expect(getNumber('coupon_confidence_threshold')).toBe(0.6);
    });

    it('returns max search radius of 50', () => {
      expect(getNumber('max_search_radius_miles')).toBe(50);
    });

    it('returns default for unknown numeric flags', () => {
      expect(getNumber('unknown', 42)).toBe(42);
    });
  });

  describe('setFlag', () => {
    it('updates a boolean flag', () => {
      expect(isEnabled('enable_delivery_uber')).toBe(true);
      setFlag('enable_delivery_uber', false, 'admin@trackhat.local');
      expect(isEnabled('enable_delivery_uber')).toBe(false);
    });

    it('updates a numeric flag', () => {
      setFlag('search_fuzzy_threshold', 3, 'admin');
      expect(getNumber('search_fuzzy_threshold')).toBe(3);
    });

    it('returns false for unknown flags', () => {
      expect(setFlag('nonexistent', true, 'admin')).toBe(false);
    });

    it('records updated_by', () => {
      setFlag('enable_payment', false, 'ops-team');
      const all = getAllFlags();
      const flag = all.find(f => f.key === 'enable_payment');
      expect(flag?.updated_by).toBe('ops-team');
    });
  });

  describe('getAllFlags', () => {
    it('returns all 6 default flags', () => {
      const flags = getAllFlags();
      expect(flags).toHaveLength(6);
      const keys = flags.map(f => f.key);
      expect(keys).toContain('enable_delivery_uber');
      expect(keys).toContain('enable_delivery_doordash');
      expect(keys).toContain('search_fuzzy_threshold');
      expect(keys).toContain('coupon_confidence_threshold');
      expect(keys).toContain('max_search_radius_miles');
      expect(keys).toContain('enable_payment');
    });
  });

  describe('_resetFlags', () => {
    it('restores defaults after changes', () => {
      setFlag('enable_payment', false, 'test');
      expect(isEnabled('enable_payment')).toBe(false);
      _resetFlags();
      expect(isEnabled('enable_payment')).toBe(true);
    });
  });
});
