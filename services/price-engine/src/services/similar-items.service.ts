/**
 * Similar Items Fallback
 * Per Phase 5 spec section 5.5:
 * When no exact match found, provide similar products.
 *
 * 1. Tokenize query into individual terms
 * 2. Partial match against product names (minimum 60% term overlap)
 * 3. Category match
 * 4. Brand alternatives in same category
 */

export interface SimilarItem {
  product_id: string;
  product_name: string;
  category: string;
  brand: string;
  match_reason: 'partial_name' | 'category' | 'brand_alternative';
  relevance_score: number;
}

export interface ProductEntry {
  product_id: string;
  canonical_name: string;
  category: string;
  brand: string;
}

// In-memory catalog (shared with price-comparison in production)
const catalog: ProductEntry[] = [];

/**
 * Find similar items for a product that wasn't found.
 * Returns up to `limit` items sorted by relevance.
 */
export function findSimilarItems(
  queryTerms: string[],
  category?: string,
  brand?: string,
  excludeProductId?: string,
  limit: number = 5,
): SimilarItem[] {
  const results: SimilarItem[] = [];

  for (const entry of catalog) {
    if (entry.product_id === excludeProductId) continue;

    const nameLower = entry.canonical_name.toLowerCase();
    const nameTokens = nameLower.split(/\s+/);

    // 1. Partial name match (minimum 60% of query terms must match)
    const matchingTerms = queryTerms.filter(t => nameLower.includes(t.toLowerCase()));
    const overlapRatio = queryTerms.length > 0 ? matchingTerms.length / queryTerms.length : 0;

    if (overlapRatio >= 0.6) {
      results.push({
        product_id: entry.product_id,
        product_name: entry.canonical_name,
        category: entry.category,
        brand: entry.brand,
        match_reason: 'partial_name',
        relevance_score: overlapRatio,
      });
      continue;
    }

    // 2. Category match
    if (category && entry.category.toLowerCase() === category.toLowerCase()) {
      results.push({
        product_id: entry.product_id,
        product_name: entry.canonical_name,
        category: entry.category,
        brand: entry.brand,
        match_reason: 'category',
        relevance_score: 0.3,
      });
      continue;
    }

    // 3. Brand alternative in same category
    if (brand && entry.brand.toLowerCase() === brand.toLowerCase() && category && entry.category.toLowerCase() === category.toLowerCase()) {
      results.push({
        product_id: entry.product_id,
        product_name: entry.canonical_name,
        category: entry.category,
        brand: entry.brand,
        match_reason: 'brand_alternative',
        relevance_score: 0.4,
      });
    }
  }

  return results
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

/** Add product to catalog */
export function addToCatalog(entry: ProductEntry): void {
  catalog.push(entry);
}

/** Clear catalog (testing) */
export function _resetCatalog(): void {
  catalog.length = 0;
}
