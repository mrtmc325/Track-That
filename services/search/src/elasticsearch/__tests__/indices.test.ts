import { describe, it, expect } from 'vitest';
import { PRODUCTS_INDEX, PRODUCTS_INDEX_SETTINGS, buildSearchQuery, buildSuggestQuery } from '../indices.js';

describe('Elasticsearch Index Configuration', () => {
  describe('Index Settings', () => {
    it('uses 30-second refresh interval per spec', () => {
      expect(PRODUCTS_INDEX_SETTINGS.settings.refresh_interval).toBe('30s');
    });

    it('defines product_analyzer with synonym filter', () => {
      const analyzer = PRODUCTS_INDEX_SETTINGS.settings.analysis.analyzer.product_analyzer;
      expect(analyzer.filter).toContain('product_synonyms');
      expect(analyzer.filter).toContain('product_stemmer');
      expect(analyzer.filter).toContain('lowercase');
    });

    it('includes synonym mappings for common food/clothing terms', () => {
      const synonyms = PRODUCTS_INDEX_SETTINGS.settings.analysis.filter.product_synonyms.synonyms;
      expect(synonyms.some((s: string) => s.includes('soda') && s.includes('pop'))).toBe(true);
      expect(synonyms.some((s: string) => s.includes('zucchini') && s.includes('courgette'))).toBe(true);
    });

    it('maps canonical_name with text + keyword + completion fields', () => {
      const props = PRODUCTS_INDEX_SETTINGS.mappings.properties;
      expect(props.canonical_name.type).toBe('text');
      expect(props.canonical_name.fields.keyword.type).toBe('keyword');
      expect(props.canonical_name.fields.suggest.type).toBe('completion');
    });

    it('maps store_listings as nested with geo_point', () => {
      const listings = PRODUCTS_INDEX_SETTINGS.mappings.properties.store_listings;
      expect(listings.type).toBe('nested');
      expect(listings.properties.location.type).toBe('geo_point');
      expect(listings.properties.current_price.type).toBe('float');
    });

    it('uses product_analyzer for canonical_name and description', () => {
      expect(PRODUCTS_INDEX_SETTINGS.mappings.properties.canonical_name.analyzer).toBe('product_analyzer');
      expect(PRODUCTS_INDEX_SETTINGS.mappings.properties.description.analyzer).toBe('product_analyzer');
    });
  });

  describe('buildSearchQuery', () => {
    it('builds a basic text query', () => {
      const q = buildSearchQuery({ query: 'organic apples' });
      expect(q.query.bool.must).toHaveLength(1);
      expect(q.query.bool.must[0].multi_match.query).toBe('organic apples');
    });

    it('adds category filter', () => {
      const q = buildSearchQuery({ query: 'milk', category: 'grocery' });
      expect(q.query.bool.filter.some((f: any) => f.term?.category === 'grocery')).toBe(true);
    });

    it('adds geo filter when lat/lng/radius provided', () => {
      const q = buildSearchQuery({ query: 'apples', lat: 33.45, lng: -112.07, radius: 10 });
      expect(q.query.bool.filter.some((f: any) => f.nested)).toBe(true);
    });

    it('enables fuzzy matching when specified', () => {
      const q = buildSearchQuery({ query: 'appls', fuzzy: true });
      expect(q.query.bool.must[0].multi_match.fuzziness).toBe('AUTO');
    });

    it('adds synonym should clauses', () => {
      const q = buildSearchQuery({ query: 'soda', synonyms: ['pop', 'cola'] });
      expect(q.query.bool.should.length).toBe(2);
    });

    it('paginates with from/size', () => {
      const q = buildSearchQuery({ query: 'test', page: 3, pageSize: 10 });
      expect(q.from).toBe(20);
      expect(q.size).toBe(10);
    });

    it('caps page size at 50', () => {
      const q = buildSearchQuery({ query: 'test', pageSize: 100 });
      expect(q.size).toBe(50);
    });
  });

  describe('buildSuggestQuery', () => {
    it('builds completion suggest query', () => {
      const q = buildSuggestQuery('org');
      expect(q.suggest.product_suggest.prefix).toBe('org');
      expect(q.suggest.product_suggest.completion.field).toBe('canonical_name.suggest');
    });

    it('respects size parameter', () => {
      const q = buildSuggestQuery('app', 5);
      expect(q.suggest.product_suggest.completion.size).toBe(5);
    });

    it('enables fuzzy suggestions', () => {
      const q = buildSuggestQuery('apl');
      expect(q.suggest.product_suggest.completion.fuzzy.fuzziness).toBe(1);
    });
  });
});
