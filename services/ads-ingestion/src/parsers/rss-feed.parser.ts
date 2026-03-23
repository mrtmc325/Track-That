/**
 * RSS/Atom Feed Parser — extracts coupons from feed items.
 * Per Phase 9 spec: parse description/content fields for coupon data.
 * In production: uses xml2js for XML parsing.
 * For dev: works with pre-parsed feed item objects.
 */
import { extractCoupon, type CouponExtraction } from '../services/extraction.service.js';

export interface FeedItem {
  title: string;
  description: string;
  link: string;
  pubDate?: string;
}

/**
 * Parse RSS/Atom feed items into coupon extractions.
 * Uses the text extraction service to find discount info in descriptions.
 */
export function parseFeedItems(
  items: FeedItem[],
  storeId: string,
): CouponExtraction[] {
  const coupons: CouponExtraction[] = [];

  for (const item of items) {
    // Combine title + description for extraction
    const text = `${item.title} ${item.description}`;
    const coupon = extractCoupon(text, storeId, item.link, 'rss');

    if (coupon && coupon.discount_value > 0) {
      // Use pub date as valid_from if available
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate);
        if (!isNaN(pubDate.getTime())) {
          coupon.valid_from = pubDate;
        }
      }
      coupons.push(coupon);
    }
  }

  return coupons;
}
