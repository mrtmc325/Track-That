/**
 * Coupon Extraction Service
 * Per Phase 9 spec: extracts coupon data from parsed content.
 * Uses regex + pattern matching to identify discount types, amounts, codes, and validity dates.
 *
 * Each extraction gets a confidence_score (0.0-1.0) based on how many fields
 * were successfully extracted vs inferred.
 *
 * security.validate_all_untrusted_input — all extracted data treated as untrusted
 */
import { logger } from '../utils/logger.js';

export type DiscountType = 'percent' | 'absolute' | 'bogo' | 'free_item';
export type SourceType = 'flyer' | 'website' | 'aggregator' | 'email' | 'rss';

export interface CouponExtraction {
  store_id: string;
  code: string | null;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  minimum_purchase: number | null;
  applicable_products: string[];
  applicable_categories: string[];
  valid_from: Date;
  valid_until: Date;
  source_url: string;
  source_type: SourceType;
  confidence_score: number;
}

/** Regex patterns for extracting discount information from text */
const PERCENT_PATTERN = /(\d{1,3})%\s*off/i;
const DOLLAR_PATTERN = /\$(\d+(?:\.\d{1,2})?)\s*off/i;
const BOGO_PATTERN = /buy\s+(?:one|1)\s+get\s+(?:one|1)\s+free/i;
const FREE_PATTERN = /free\s+(?:item|product|gift)/i;
const CODE_PATTERN = /(?:code|coupon|promo)[:\s]+([A-Z0-9]{3,20})/i;
const MIN_PURCHASE_PATTERN = /(?:min(?:imum)?|spend)\s*\$?(\d+(?:\.\d{1,2})?)/i;
const DATE_PATTERN = /(?:valid|expires?|through|until|ends?)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;

/**
 * Extract coupon data from raw text content.
 * Returns a CouponExtraction with confidence score based on extraction quality.
 *
 * Confidence scoring:
 *   +0.3 if discount type + value extracted
 *   +0.2 if coupon code found
 *   +0.2 if valid dates extracted
 *   +0.2 if description is meaningful (>10 chars)
 *   +0.1 if minimum purchase found
 */
export function extractCoupon(
  text: string,
  storeId: string,
  sourceUrl: string,
  sourceType: SourceType,
): CouponExtraction | null {
  if (!text || text.trim().length < 5) return null;

  // Sanitize input — strip HTML tags
  const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  let discountType: DiscountType = 'absolute';
  let discountValue = 0;
  let confidence = 0;

  // Extract discount type and value
  const percentMatch = cleanText.match(PERCENT_PATTERN);
  const dollarMatch = cleanText.match(DOLLAR_PATTERN);
  const bogoMatch = cleanText.match(BOGO_PATTERN);
  const freeMatch = cleanText.match(FREE_PATTERN);

  if (percentMatch) {
    discountType = 'percent';
    discountValue = parseFloat(percentMatch[1]);
    confidence += 0.3;
  } else if (dollarMatch) {
    discountType = 'absolute';
    discountValue = parseFloat(dollarMatch[1]);
    confidence += 0.3;
  } else if (bogoMatch) {
    discountType = 'bogo';
    discountValue = 100; // Represents 100% off second item
    confidence += 0.3;
  } else if (freeMatch) {
    discountType = 'free_item';
    discountValue = 0;
    confidence += 0.2; // Lower confidence for free item (value unknown)
  } else {
    // No discount pattern found — very low confidence
    confidence += 0.05;
  }

  // Extract coupon code
  const codeMatch = cleanText.match(CODE_PATTERN);
  const code = codeMatch ? codeMatch[1].toUpperCase() : null;
  if (code) confidence += 0.2;

  // Extract minimum purchase
  const minMatch = cleanText.match(MIN_PURCHASE_PATTERN);
  const minimumPurchase = minMatch ? parseFloat(minMatch[1]) : null;
  if (minimumPurchase) confidence += 0.1;

  // Extract dates
  let validFrom = new Date();
  let validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default: 7 days
  const dateMatch = cleanText.match(DATE_PATTERN);
  if (dateMatch) {
    const parsed = parseDate(dateMatch[1]);
    if (parsed) {
      validUntil = parsed;
      confidence += 0.2;
    }
  }

  // Description quality
  const description = cleanText.substring(0, 200).trim();
  if (description.length > 10) confidence += 0.2;

  // Clamp confidence to 1.0
  confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

  logger.debug('extraction.coupon', 'Coupon extracted', {
    store_id: storeId,
    discount_type: discountType,
    discount_value: discountValue,
    confidence,
    has_code: !!code,
  });

  return {
    store_id: storeId,
    code,
    description,
    discount_type: discountType,
    discount_value: discountValue,
    minimum_purchase: minimumPurchase,
    applicable_products: [],
    applicable_categories: [],
    valid_from: validFrom,
    valid_until: validUntil,
    source_url: sourceUrl,
    source_type: sourceType,
    confidence_score: confidence,
  };
}

/**
 * Extract multiple coupons from a block of text (e.g., a flyer page).
 * Splits on common coupon delimiters and extracts each.
 */
export function extractMultipleCoupons(
  text: string,
  storeId: string,
  sourceUrl: string,
  sourceType: SourceType,
): CouponExtraction[] {
  // Split on common delimiters: double newlines, horizontal rules, "---"
  const blocks = text.split(/\n{2,}|<hr\s*\/?>|---+/).filter(b => b.trim().length > 5);
  const coupons: CouponExtraction[] = [];

  for (const block of blocks) {
    const coupon = extractCoupon(block, storeId, sourceUrl, sourceType);
    if (coupon && coupon.discount_value > 0) {
      coupons.push(coupon);
    }
  }

  return coupons;
}

/** Parse a date string in common formats (MM/DD/YYYY, MM-DD-YYYY, etc.) */
function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split(/[\/\-]/);
  if (parts.length !== 3) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 23, 59, 59);
  if (isNaN(date.getTime())) return null;
  return date;
}
