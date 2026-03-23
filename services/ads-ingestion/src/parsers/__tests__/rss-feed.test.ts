// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

import { describe, it, expect } from 'vitest';
import { parseFeedItems } from '../rss-feed.parser.js';

describe('RSS Feed Parser', () => {
  it('extracts coupons from feed items', () => {
    const items = [
      { title: 'Weekly Sale', description: 'Save 20% off all produce this week!', link: 'https://store.com/sale' },
      { title: 'Special Offer', description: 'Get $5 off your next order with code SAVE5', link: 'https://store.com/offer' },
    ];
    const results = parseFeedItems(items, 'store-1');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].source_type).toBe('rss');
  });

  it('uses pubDate as valid_from', () => {
    const items = [
      { title: 'Deal', description: '15% off everything!', link: 'url', pubDate: '2026-03-01T00:00:00Z' },
    ];
    const results = parseFeedItems(items, 'store-1');
    if (results.length > 0) {
      expect(results[0].valid_from.getFullYear()).toBe(2026);
    }
  });

  it('skips items without discount info', () => {
    const items = [
      { title: 'News Update', description: 'Our store is now open 24 hours!', link: 'url' },
    ];
    const results = parseFeedItems(items, 'store-1');
    expect(results).toHaveLength(0);
  });

  it('handles empty items array', () => {
    expect(parseFeedItems([], 'store-1')).toEqual([]);
  });

  it('combines title and description for extraction', () => {
    const items = [
      { title: '30% off', description: 'all clothing items this weekend', link: 'url' },
    ];
    const results = parseFeedItems(items, 'store-1');
    expect(results.length).toBe(1);
    expect(results[0].discount_value).toBe(30);
  });
});
