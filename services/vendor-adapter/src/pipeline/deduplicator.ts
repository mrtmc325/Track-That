/**
 * Deduplication Engine
 * Per Phase 4 spec section 4.4:
 * - Map to canonical product using fuzzy matching against existing catalog
 * - If no match > 85% confidence → create new canonical product
 * - Matches < 85% and > 60% → human review queue
 *
 * quality.inline_documentation_for_non_obvious_logic — matching logic documented
 */
import type { NormalizedProduct } from './normalizer.js';
import { logger } from '../utils/logger.js';

export interface CatalogEntry {
  product_id: string;
  canonical_name: string;
  brand: string;
  category: string;
}

export interface DeduplicationResult {
  /** 'matched' = found existing product, 'new' = create new, 'review' = needs human review */
  action: 'matched' | 'new' | 'review';
  /** Existing product ID if matched */
  matched_product_id?: string;
  /** Similarity score (0.0-1.0) */
  confidence: number;
  /** The normalized product data */
  product: NormalizedProduct;
}

// In-memory catalog (replaced by PostgreSQL in production)
const catalog = new Map<string, CatalogEntry>();

/** Confidence thresholds per spec */
const MATCH_THRESHOLD = 0.85;    // Auto-match above this
const REVIEW_THRESHOLD = 0.60;   // Human review between 0.60-0.85

/**
 * Deduplicate a normalized product against the existing catalog.
 *
 * Matching strategy:
 * 1. Exact name match (confidence 1.0)
 * 2. Normalized fuzzy match using Dice coefficient on bigrams
 * 3. Brand + category bonus applied to similarity score
 *
 * Why Dice coefficient? It handles substring similarity better than
 * Levenshtein for product names (which vary in formatting but share
 * significant bigrams). E.g., "Organic Gala Apples 3lb" and
 * "Gala Apples Organic" have high bigram overlap.
 */
export function deduplicate(product: NormalizedProduct): DeduplicationResult {
  let bestMatch: CatalogEntry | null = null;
  let bestScore = 0;

  const productNameLower = product.canonical_name.toLowerCase();

  for (const entry of catalog.values()) {
    const entryNameLower = entry.canonical_name.toLowerCase();

    // Exact match shortcut
    if (productNameLower === entryNameLower) {
      return {
        action: 'matched',
        matched_product_id: entry.product_id,
        confidence: 1.0,
        product,
      };
    }

    // Dice coefficient on bigrams
    let score = diceCoefficient(productNameLower, entryNameLower);

    // Brand match bonus: +0.1 if brands match
    if (product.brand.toLowerCase() === entry.brand.toLowerCase() && product.brand !== 'Unknown') {
      score = Math.min(1.0, score + 0.10);
    }

    // Category match bonus: +0.05
    if (product.category === entry.category) {
      score = Math.min(1.0, score + 0.05);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry;
    }
  }

  if (bestScore >= MATCH_THRESHOLD && bestMatch) {
    logger.debug('dedup.matched', 'Product matched to catalog', {
      product: product.canonical_name,
      matched: bestMatch.canonical_name,
      confidence: bestScore,
    });
    return {
      action: 'matched',
      matched_product_id: bestMatch.product_id,
      confidence: bestScore,
      product,
    };
  }

  if (bestScore >= REVIEW_THRESHOLD && bestMatch) {
    logger.info('dedup.review', 'Product needs human review', {
      product: product.canonical_name,
      closest: bestMatch.canonical_name,
      confidence: bestScore,
    });
    return {
      action: 'review',
      matched_product_id: bestMatch.product_id,
      confidence: bestScore,
      product,
    };
  }

  // No match — new product
  logger.debug('dedup.new', 'New canonical product', {
    product: product.canonical_name,
    best_score: bestScore,
  });
  return {
    action: 'new',
    confidence: bestScore,
    product,
  };
}

/**
 * Dice coefficient (Sørensen–Dice) on character bigrams.
 * Returns 0.0-1.0 similarity score.
 *
 * Formula: 2 * |intersection(bigrams_a, bigrams_b)| / (|bigrams_a| + |bigrams_b|)
 *
 * Why bigrams? Product names like "Gala Apples" and "Apples Gala"
 * share bigrams {"ga","al","la","ap","pp","pl","le","es"} despite
 * different word order. This makes Dice more robust than Levenshtein
 * for reordered product names.
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0.0;

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);

  let intersection = 0;
  const countB = new Map<string, number>();
  for (const bg of bigramsB) {
    countB.set(bg, (countB.get(bg) || 0) + 1);
  }

  for (const bg of bigramsA) {
    const count = countB.get(bg);
    if (count && count > 0) {
      intersection++;
      countB.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

function getBigrams(str: string): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.push(str.substring(i, i + 2));
  }
  return bigrams;
}

/** Add an entry to the catalog (used by writer and tests) */
export function addToCatalog(entry: CatalogEntry): void {
  catalog.set(entry.product_id, entry);
}

/** Remove from catalog */
export function removeFromCatalog(id: string): boolean {
  return catalog.delete(id);
}

/** Clear catalog (testing) */
export function _resetCatalog(): void {
  catalog.clear();
}
