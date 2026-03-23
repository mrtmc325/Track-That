// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Elasticsearch Index Configuration
 * Per Phase 11 spec + Phase 3 section 3.4:
 * Product search index with nested store_listings, geo_point, custom analyzer.
 *
 * operability.observability_by_default — index health logged
 * scalability.performance_budgets_as_contracts — 30s refresh interval per spec
 */

export const PRODUCTS_INDEX = 'track_that_products';

/**
 * Product index settings with custom product_analyzer.
 * Analyzer pipeline: lowercase → asciifolding → stemmer → synonym filter.
 */
export const PRODUCTS_INDEX_SETTINGS = {
  settings: {
    number_of_shards: 1,     // Single shard for MVP single-metro deployment
    number_of_replicas: 0,    // Dev mode; 1+ in production
    refresh_interval: '30s',  // Per spec: near-real-time, not immediate
    analysis: {
      analyzer: {
        product_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'product_stemmer', 'product_synonyms'],
        },
      },
      filter: {
        product_stemmer: {
          type: 'stemmer',
          language: 'english',
        },
        product_synonyms: {
          type: 'synonym',
          synonyms: [
            'soda,pop,soft drink,cola',
            'chips,crisps',
            'candy,sweets,confection',
            'sneakers,trainers,athletic shoes',
            'pants,trousers',
            'sweater,jumper,pullover',
            'yogurt,yoghurt',
            'ketchup,catsup',
            'zucchini,courgette',
            'eggplant,aubergine',
            'cilantro,coriander',
            'arugula,rocket',
            'scallion,green onion,spring onion',
          ],
        },
      },
    },
  },
  mappings: {
    properties: {
      product_id: { type: 'keyword' },
      canonical_name: {
        type: 'text',
        analyzer: 'product_analyzer',
        fields: {
          keyword: { type: 'keyword' },
          suggest: {
            type: 'completion',
            analyzer: 'simple',
            preserve_separators: true,
            preserve_position_increments: true,
            max_input_length: 100,
          },
        },
      },
      category: { type: 'keyword' },
      subcategory: { type: 'keyword' },
      brand: {
        type: 'text',
        fields: {
          keyword: { type: 'keyword' },
        },
      },
      description: { type: 'text', analyzer: 'product_analyzer' },
      image_urls: { type: 'keyword', index: false },
      store_listings: {
        type: 'nested',
        properties: {
          store_id: { type: 'keyword' },
          store_name: {
            type: 'text',
            fields: { keyword: { type: 'keyword' } },
          },
          current_price: { type: 'float' },
          original_price: { type: 'float' },
          on_sale: { type: 'boolean' },
          store_rating: { type: 'float' },
          location: { type: 'geo_point' },
          last_updated: { type: 'date' },
        },
      },
      created_at: { type: 'date' },
      updated_at: { type: 'date' },
    },
  },
};

/**
 * Build the search query for a processed search request.
 * Combines full-text match, fuzzy matching, and geo filtering.
 */
export function buildSearchQuery(params: {
  query: string;
  synonyms?: string[];
  lat?: number;
  lng?: number;
  radius?: number;
  category?: string;
  page?: number;
  pageSize?: number;
  fuzzy?: boolean;
}): Record<string, unknown> {
  const must: Record<string, unknown>[] = [];
  const filter: Record<string, unknown>[] = [];
  const should: Record<string, unknown>[] = [];

  // Main text query with boosting
  must.push({
    multi_match: {
      query: params.query,
      fields: ['canonical_name^3', 'brand^2', 'description'],
      type: 'best_fields',
      fuzziness: params.fuzzy ? 'AUTO' : 0,
    },
  });

  // Synonym expansion via should clauses (boosts but doesn't require)
  if (params.synonyms && params.synonyms.length > 0) {
    for (const syn of params.synonyms) {
      should.push({
        multi_match: {
          query: syn,
          fields: ['canonical_name^2', 'description'],
          boost: 0.5,
        },
      });
    }
  }

  // Category filter
  if (params.category) {
    filter.push({ term: { category: params.category } });
  }

  // Geo filter on nested store_listings
  if (params.lat !== undefined && params.lng !== undefined && params.radius) {
    filter.push({
      nested: {
        path: 'store_listings',
        query: {
          geo_distance: {
            distance: `${params.radius}mi`,
            'store_listings.location': {
              lat: params.lat,
              lon: params.lng,
            },
          },
        },
      },
    });
  }

  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 50);

  return {
    from: (page - 1) * pageSize,
    size: pageSize,
    query: {
      bool: {
        must,
        should,
        filter,
        minimum_should_match: should.length > 0 ? 1 : 0,
      },
    },
    sort: [
      { _score: { order: 'desc' } },
      { 'canonical_name.keyword': { order: 'asc' } },
    ],
  };
}

/**
 * Build autocomplete suggestion query.
 */
export function buildSuggestQuery(prefix: string, size: number = 10): Record<string, unknown> {
  return {
    suggest: {
      product_suggest: {
        prefix,
        completion: {
          field: 'canonical_name.suggest',
          size,
          skip_duplicates: true,
          fuzzy: {
            fuzziness: 1,
          },
        },
      },
    },
  };
}
