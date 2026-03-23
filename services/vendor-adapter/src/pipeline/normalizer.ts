/**
 * Data Normalization Pipeline
 * Per Phase 4 spec section 4.4:
 * 1. Strip store-specific prefixes/suffixes
 * 2. Extract brand, product name, size/weight, variant
 * 3. Normalize prices to USD decimal (2 decimal places)
 * 4. Flag anomalous prices for review
 *
 * security.validate_all_untrusted_input — all scraped data treated as untrusted
 * security.output_encoding_and_injection_prevention — sanitize before storage
 */
import type { RawProduct } from '../adapters/adapter.interface.js';
import { logger } from '../utils/logger.js';

export interface NormalizedProduct {
  canonical_name: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  image_url: string;
  unit_of_measure: string;
  current_price: number;
  original_price: number;
  on_sale: boolean;
  source_url: string;
  /** Confidence in name extraction (0.0-1.0) */
  name_confidence: number;
  /** Flags for human review */
  review_flags: string[];
}

/** Store-specific prefixes/suffixes to strip from product names */
const STORE_PREFIXES = [
  'store brand', 'private selection', 'signature select', 'great value',
  'kirkland', 'market pantry', 'good & gather', 'simply balanced',
  'open nature', "sprouts farmers market", 'trader joe\'s',
  'whole foods 365', '365 everyday value', 'o organics',
];

/** Weight/size patterns to extract from product names */
const SIZE_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(oz|ounce|ounces|fl\s*oz|lb|lbs|pound|pounds|g|grams?|kg|ml|l|liter|liters?|gal|gallon|gallons?|qt|quart|quarts?|pt|pint|pints?|ct|count|pk|pack)\b/gi,
];

/**
 * Normalize a raw product name.
 * Steps: strip prefixes → extract size → clean up → title case
 */
export function normalizeProductName(rawName: string): { name: string; brand: string; size: string; confidence: number } {
  let name = rawName.trim();
  let extractedBrand = '';
  let extractedSize = '';
  let confidence = 1.0;

  // 1. Strip HTML (defense against scraped content)
  name = name.replace(/<[^>]*>/g, '');

  // 2. Strip store-specific prefixes
  const lowerName = name.toLowerCase();
  for (const prefix of STORE_PREFIXES) {
    if (lowerName.startsWith(prefix)) {
      extractedBrand = name.substring(0, prefix.length).trim();
      name = name.substring(prefix.length).trim();
      // Remove leading dash or comma after prefix strip
      name = name.replace(/^[-,]\s*/, '');
      break;
    }
  }

  // 3. Extract size/weight
  for (const pattern of SIZE_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      extractedSize = match[0];
      name = name.replace(match[0], '').trim();
    }
  }

  // 4. Clean up: remove double spaces, trailing commas/dashes
  name = name.replace(/\s+/g, ' ').replace(/[,\-]+$/, '').trim();

  // 5. Reduce confidence if name is very short or very long
  if (name.length < 3) confidence = 0.4;
  else if (name.length > 100) confidence = 0.7;

  // 6. Title case
  name = toTitleCase(name);

  return { name, brand: extractedBrand, size: extractedSize, confidence };
}

/**
 * Normalize a price value.
 * Converts various formats to USD decimal (2 decimal places).
 * Flags anomalous prices for review.
 */
export function normalizePrice(raw: string | number): { price: number; flags: string[] } {
  const flags: string[] = [];

  let numericValue: number;

  if (typeof raw === 'number') {
    numericValue = raw;
  } else {
    // Strip currency symbols and commas
    const cleaned = raw.replace(/[$€£¥,]/g, '').trim();
    numericValue = parseFloat(cleaned);
  }

  if (isNaN(numericValue)) {
    return { price: 0, flags: ['UNPARSEABLE_PRICE'] };
  }

  // Round to 2 decimal places
  numericValue = Math.round(numericValue * 100) / 100;

  // Flag anomalous prices
  if (numericValue < 0) {
    flags.push('NEGATIVE_PRICE');
  }
  if (numericValue === 0) {
    flags.push('ZERO_PRICE');
  }
  if (numericValue > 10000) {
    flags.push('PRICE_EXCEEDS_10K');
  }

  return { price: numericValue, flags };
}

/**
 * Full normalization pipeline for a raw product.
 */
export function normalizeProduct(raw: RawProduct): NormalizedProduct {
  const nameResult = normalizeProductName(raw.raw_name);
  const priceResult = normalizePrice(raw.raw_price);
  const originalPriceResult = raw.original_price
    ? normalizePrice(raw.original_price)
    : { price: priceResult.price, flags: [] };

  const reviewFlags = [...priceResult.flags, ...originalPriceResult.flags];

  // Low name confidence → flag for review
  if (nameResult.confidence < 0.6) {
    reviewFlags.push('LOW_NAME_CONFIDENCE');
  }

  // Brand from extraction or raw data
  const brand = raw.brand || nameResult.brand || 'Unknown';
  const category = raw.category || 'uncategorized';

  return {
    canonical_name: nameResult.name,
    brand,
    category: category.toLowerCase(),
    subcategory: '',
    description: sanitizeText(raw.description || ''),
    image_url: raw.image_url || '',
    unit_of_measure: nameResult.size || raw.unit_of_measure || '',
    current_price: priceResult.price,
    original_price: originalPriceResult.price,
    on_sale: raw.on_sale || priceResult.price < originalPriceResult.price,
    source_url: raw.source_url,
    name_confidence: nameResult.confidence,
    review_flags: reviewFlags,
  };
}

/**
 * Sanitize text for safe storage.
 * Strips HTML and limits length.
 * Per security.output_encoding_and_injection_prevention.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')     // Strip HTML
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Strip control chars
    .substring(0, 1000)          // Limit length
    .trim();
}

function toTitleCase(str: string): string {
  const minor = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'at', 'by', 'in', 'of', 'on', 'to', 'up', 'with']);
  return str.split(' ').map((word, i) => {
    if (i === 0 || !minor.has(word.toLowerCase())) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    return word.toLowerCase();
  }).join(' ');
}
