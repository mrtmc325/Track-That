import { describe, it, expect } from 'vitest';
import {
  validateQuery,
  stripHtml,
  normalizeQuery,
  dictionaryCheck,
  expandSynonyms,
  processQuery,
  levenshteinDistance,
} from '../query-processor.js';

describe('Query Processor', () => {
  describe('validateQuery', () => {
    it('accepts valid queries', () => {
      expect(validateQuery('organic apples').valid).toBe(true);
      expect(validateQuery('chicken breast').valid).toBe(true);
      expect(validateQuery('ab').valid).toBe(true); // minimum 2 chars
    });

    it('rejects too-short queries', () => {
      const result = validateQuery('a');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('QUERY_TOO_SHORT');
    });

    it('rejects empty queries', () => {
      expect(validateQuery('').valid).toBe(false);
      expect(validateQuery('  ').valid).toBe(false);
    });

    it('rejects too-long queries', () => {
      expect(validateQuery('a'.repeat(201)).valid).toBe(false);
      expect(validateQuery('a'.repeat(201)).errorCode).toBe('QUERY_TOO_LONG');
    });

    it('rejects script injection', () => {
      expect(validateQuery('<script>alert(1)</script>').valid).toBe(false);
      expect(validateQuery('javascript:void(0)').valid).toBe(false);
      expect(validateQuery('onclick=alert(1)').valid).toBe(false);
    });

    it('rejects SQL injection patterns', () => {
      expect(validateQuery("' OR '1'='1").valid).toBe(false);
      expect(validateQuery('UNION SELECT * FROM users').valid).toBe(false);
      expect(validateQuery('; DROP TABLE products --').valid).toBe(false);
    });

    it('rejects pure numeric input', () => {
      const result = validateQuery('12345');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NUMERIC_ONLY');
    });

    it('rejects pure special characters', () => {
      const result = validateQuery('!!!???');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SPECIAL_CHARS_ONLY');
    });

    it('accepts queries at max length', () => {
      expect(validateQuery('a'.repeat(200)).valid).toBe(true);
    });
  });

  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(stripHtml('<b>bold</b>')).toBe('bold');
      expect(stripHtml('<script>evil()</script>text')).toBe('evil()text');
      expect(stripHtml('no tags')).toBe('no tags');
    });

    it('handles nested tags', () => {
      expect(stripHtml('<div><p>hello</p></div>')).toBe('hello');
    });
  });

  describe('normalizeQuery', () => {
    it('lowercases and trims', () => {
      expect(normalizeQuery('  ORGANIC APPLES  ')).toBe('organic apples');
    });

    it('removes special characters except hyphens and apostrophes', () => {
      expect(normalizeQuery("mom's cookies!")).toBe("mom's cookies");
      expect(normalizeQuery('sugar-free')).toBe('sugar-free');
      expect(normalizeQuery('price$5')).toBe('price5');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeQuery('organic   whole   milk')).toBe('organic whole milk');
    });

    it('expands abbreviations', () => {
      expect(normalizeQuery('16 oz milk')).toBe('16 ounce milk');
      expect(normalizeQuery('5 lb chicken')).toBe('5 pound chicken');
      expect(normalizeQuery('org apples')).toBe('organic apples');
    });
  });

  describe('dictionaryCheck', () => {
    it('finds exact dictionary words', () => {
      const result = dictionaryCheck(['organic', 'apples']);
      expect(result.valid).toBe(true);
      expect(result.matchedWords).toBe(2);
      expect(result.fuzzyRequired).toBe(false);
    });

    it('finds fuzzy matches for misspellings', () => {
      const result = dictionaryCheck(['appls']); // close to "apples"
      expect(result.valid).toBe(true);
      expect(result.fuzzyRequired).toBe(true);
    });

    it('rejects complete nonsense', () => {
      const result = dictionaryCheck(['xyzqwkjhg']);
      expect(result.valid).toBe(false);
    });

    it('passes if at least one word matches', () => {
      const result = dictionaryCheck(['xyzabc', 'milk']);
      expect(result.valid).toBe(true);
      expect(result.fuzzyRequired).toBe(false);
    });

    it('skips single-char tokens', () => {
      const result = dictionaryCheck(['a', 'b']);
      expect(result.valid).toBe(false);
    });
  });

  describe('expandSynonyms', () => {
    it('expands soda to pop and soft drink', () => {
      const result = expandSynonyms(['soda']);
      expect(result).toContain('soda');
      expect(result).toContain('pop');
      expect(result).toContain('soft drink');
      expect(result).toContain('cola');
    });

    it('expands zucchini to courgette', () => {
      const result = expandSynonyms(['zucchini']);
      expect(result).toContain('courgette');
    });

    it('preserves non-synonym words', () => {
      const result = expandSynonyms(['organic', 'milk']);
      expect(result).toContain('organic');
      expect(result).toContain('milk');
    });

    it('does not duplicate original term', () => {
      const result = expandSynonyms(['soda']);
      const sodaCount = result.filter(r => r === 'soda').length;
      expect(sodaCount).toBe(1);
    });
  });

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('apple', 'apple')).toBe(0);
    });

    it('returns 1 for single character difference', () => {
      expect(levenshteinDistance('apple', 'appl')).toBe(1);
      expect(levenshteinDistance('apple', 'appme')).toBe(1);
    });

    it('returns 2 for two edits', () => {
      expect(levenshteinDistance('apple', 'app')).toBe(2);
    });

    it('handles empty strings', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });
  });

  describe('processQuery (full pipeline)', () => {
    it('processes a valid query end-to-end', () => {
      const result = processQuery('Organic Apples');
      expect('result' in result).toBe(true);
      if ('result' in result) {
        expect(result.result.normalized).toBe('organic apples');
        expect(result.result.tokens).toEqual(['organic', 'apples']);
        expect(result.result.fuzzyRequired).toBe(false);
      }
    });

    it('rejects invalid queries', () => {
      const result = processQuery('a');
      expect('error' in result).toBe(true);
    });

    it('rejects nonsense words', () => {
      const result = processQuery('xyzqwkjhg qqqqq');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error.errorCode).toBe('NO_DICTIONARY_MATCH');
      }
    });

    it('handles abbreviation expansion', () => {
      const result = processQuery('16 oz milk');
      expect('result' in result).toBe(true);
      if ('result' in result) {
        expect(result.result.normalized).toContain('ounce');
      }
    });

    it('includes synonyms in expansion', () => {
      const result = processQuery('soda');
      expect('result' in result).toBe(true);
      if ('result' in result) {
        expect(result.result.synonyms).toContain('pop');
        expect(result.result.synonyms).toContain('soft drink');
      }
    });

    it('strips HTML from query', () => {
      const result = processQuery('<b>chicken</b> breast');
      expect('result' in result).toBe(true);
      if ('result' in result) {
        expect(result.result.normalized).toBe('chicken breast');
      }
    });
  });
});
