// Copyright (C) 2026 Tristan Conner <tmconner325@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later
// This file is part of Track-That. See LICENSE for details.

/**
 * Search Query Processor
 * Per Phase 3 spec: validation → dictionary check → normalization → synonym expansion
 *
 * security.validate_all_untrusted_input — all search input validated and sanitized
 * security.output_encoding_and_injection_prevention — HTML/script tags stripped
 */

/** Abbreviation expansions applied during normalization */
const ABBREVIATIONS: Record<string, string> = {
  'oz': 'ounce',
  'lb': 'pound',
  'lbs': 'pounds',
  'pkg': 'package',
  'ct': 'count',
  'qt': 'quart',
  'gal': 'gallon',
  'pt': 'pint',
  'tbsp': 'tablespoon',
  'tsp': 'teaspoon',
  'doz': 'dozen',
  'sm': 'small',
  'md': 'medium',
  'lg': 'large',
  'xl': 'extra large',
  'org': 'organic',
};

/** Synonym groups — any word maps to all others in its group */
const SYNONYM_GROUPS: string[][] = [
  ['soda', 'pop', 'soft drink', 'cola'],
  ['chips', 'crisps'],
  ['candy', 'sweets', 'confection'],
  ['napkin', 'serviette'],
  ['diaper', 'nappy'],
  ['trash bag', 'garbage bag', 'bin liner'],
  ['sneakers', 'trainers', 'athletic shoes'],
  ['hoodie', 'hooded sweatshirt'],
  ['pants', 'trousers'],
  ['sweater', 'jumper', 'pullover'],
  ['t-shirt', 'tee', 'tee shirt'],
  ['jacket', 'coat', 'outerwear'],
  ['ground beef', 'minced beef', 'hamburger meat'],
  ['chicken breast', 'chicken fillet'],
  ['whole milk', 'full fat milk'],
  ['skim milk', 'nonfat milk', 'fat free milk'],
  ['yogurt', 'yoghurt'],
  ['ketchup', 'catsup'],
  ['zucchini', 'courgette'],
  ['eggplant', 'aubergine'],
  ['cilantro', 'coriander'],
  ['arugula', 'rocket'],
  ['scallion', 'green onion', 'spring onion'],
];

/** Build a lookup map from each word/phrase to its synonym group */
const synonymMap = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const term of group) {
    synonymMap.set(term.toLowerCase(), group.map(g => g.toLowerCase()));
  }
}

/**
 * Common English dictionary words (subset for validation).
 * In production, load from a full dictionary file.
 * This covers the most common grocery/clothing/general terms.
 */
const COMMON_WORDS = new Set([
  // Foods
  'apple', 'apples', 'banana', 'bananas', 'orange', 'oranges', 'grape', 'grapes',
  'bread', 'milk', 'cheese', 'butter', 'egg', 'eggs', 'chicken', 'beef', 'pork',
  'fish', 'rice', 'pasta', 'noodle', 'noodles', 'cereal', 'oat', 'oats', 'flour',
  'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'soup', 'salad', 'lettuce',
  'tomato', 'tomatoes', 'potato', 'potatoes', 'onion', 'onions', 'garlic', 'carrot',
  'carrots', 'broccoli', 'spinach', 'corn', 'bean', 'beans', 'pea', 'peas',
  'mushroom', 'mushrooms', 'avocado', 'lemon', 'lime', 'strawberry', 'blueberry',
  'raspberry', 'watermelon', 'melon', 'peach', 'pear', 'cherry', 'mango', 'pineapple',
  'coconut', 'nut', 'nuts', 'almond', 'almonds', 'peanut', 'peanuts', 'walnut',
  'cashew', 'honey', 'jam', 'jelly', 'syrup', 'chocolate', 'candy', 'cookie',
  'cookies', 'cake', 'pie', 'ice', 'cream', 'yogurt', 'yoghurt', 'juice',
  'water', 'soda', 'pop', 'coffee', 'tea', 'beer', 'wine', 'snack', 'snacks',
  'chip', 'chips', 'cracker', 'crackers', 'popcorn', 'pretzel', 'pretzels',
  'ketchup', 'mustard', 'mayo', 'mayonnaise', 'ranch', 'dressing', 'salsa',
  'tortilla', 'wrap', 'bun', 'bagel', 'muffin', 'donut', 'doughnut',
  'steak', 'ham', 'bacon', 'sausage', 'turkey', 'lamb', 'shrimp', 'salmon',
  'tuna', 'crab', 'lobster', 'tofu', 'tempeh',
  'hamburger', 'burger', 'burgers', 'hotdog', 'hot', 'dog', 'pizza', 'pasta',
  'noodle', 'noodles', 'taco', 'tacos', 'burrito', 'sandwich', 'sub', 'wrap',
  'wing', 'wings', 'tender', 'tenders', 'nugget', 'nuggets', 'fries',
  'ground', 'beef', 'pork', 'ribs', 'roast', 'chop', 'chops', 'filet', 'fillet',
  'organic', 'natural', 'fresh', 'frozen', 'canned', 'dried',
  'protein', 'bar', 'bars', 'shake', 'shakes', 'supplement', 'vitamin', 'vitamins',
  'cleaning', 'laundry', 'dish', 'dishes', 'spray', 'wipe', 'wipes',
  // Clothing
  'shirt', 'pants', 'jeans', 'shorts', 'dress', 'skirt', 'blouse', 'sweater',
  'jacket', 'coat', 'hoodie', 'vest', 'suit', 'tie', 'scarf', 'hat', 'cap',
  'gloves', 'socks', 'shoes', 'boots', 'sandals', 'sneakers', 'heels',
  'belt', 'bag', 'purse', 'wallet', 'watch', 'jewelry', 'ring', 'necklace',
  'bracelet', 'earring', 'earrings', 'sunglasses', 'underwear', 'bra',
  'pajamas', 'robe', 'swimsuit', 'bikini', 'leggings', 'tights',
  // General
  'organic', 'fresh', 'frozen', 'canned', 'dried', 'raw', 'cooked', 'baked',
  'grilled', 'fried', 'roasted', 'smoked', 'seasoned', 'marinated',
  'natural', 'gluten', 'free', 'vegan', 'vegetarian', 'dairy',
  'whole', 'grain', 'wheat', 'white', 'brown', 'wild',
  'small', 'medium', 'large', 'extra', 'pack', 'package', 'box', 'bag',
  'bottle', 'can', 'jar', 'container', 'roll', 'loaf', 'bunch', 'dozen',
  'pound', 'ounce', 'gallon', 'quart', 'pint', 'liter', 'count',
  'red', 'green', 'blue', 'black', 'white', 'pink', 'yellow', 'purple',
  'cotton', 'polyester', 'wool', 'silk', 'linen', 'denim', 'leather',
  'mens', 'womens', 'kids', 'baby', 'toddler', 'boys', 'girls',
  // Household
  'paper', 'towel', 'towels', 'tissue', 'tissues', 'napkin', 'napkins',
  'soap', 'shampoo', 'conditioner', 'lotion', 'deodorant', 'toothpaste',
  'detergent', 'bleach', 'sponge', 'brush', 'broom', 'mop',
  'trash', 'garbage', 'diaper', 'diapers', 'wipes', 'battery', 'batteries',
  'light', 'bulb', 'candle', 'match', 'lighter', 'tape', 'glue',
]);

/** Known injection patterns to reject */
const INJECTION_PATTERNS = [
  /<script[\s>]/i,
  /<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,          // onclick=, onload=, etc.
  /union\s+select/i,      // SQL injection
  /;\s*drop\s+/i,         // SQL injection
  /'\s*or\s+['1]/i,       // SQL injection
  /--\s*$/,               // SQL comment
  /\/\*.*\*\//,           // Block comment
];

export interface QueryValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: string;
}

export interface ProcessedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  synonyms: string[];
  fuzzyRequired: boolean;
  dictionaryWordsFound: number;
}

/**
 * Validate raw search input.
 * Per security.validate_all_untrusted_input — reject early with safe errors.
 */
export function validateQuery(query: string): QueryValidationResult {
  // Length checks
  if (!query || query.trim().length < 2) {
    return { valid: false, error: 'Search query must be at least 2 characters', errorCode: 'QUERY_TOO_SHORT' };
  }
  if (query.length > 200) {
    return { valid: false, error: 'Search query must be 200 characters or fewer', errorCode: 'QUERY_TOO_LONG' };
  }

  // Injection pattern check
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      return { valid: false, error: 'Invalid search query', errorCode: 'INVALID_QUERY' };
    }
  }

  // Pure numeric check
  if (/^\d+$/.test(query.trim())) {
    return { valid: false, error: 'Search query must contain words, not just numbers', errorCode: 'NUMERIC_ONLY' };
  }

  // Pure special character check
  if (/^[^a-zA-Z0-9]+$/.test(query.trim())) {
    return { valid: false, error: 'Search query must contain words', errorCode: 'SPECIAL_CHARS_ONLY' };
  }

  return { valid: true };
}

/**
 * Strip HTML tags to prevent XSS.
 * Per security.output_encoding_and_injection_prevention.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Normalize a search query through the full pipeline.
 * Steps: lowercase → strip HTML → remove special chars → expand abbreviations → stemming-like cleanup
 */
export function normalizeQuery(query: string): string {
  let normalized = query.toLowerCase().trim();

  // Strip HTML/script tags
  normalized = stripHtml(normalized);

  // Remove special characters except hyphens, apostrophes, and spaces
  normalized = normalized.replace(/[^a-z0-9\s\-']/g, '');

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Expand abbreviations
  const words = normalized.split(' ');
  const expanded = words.map(w => ABBREVIATIONS[w] || w);
  normalized = expanded.join(' ');

  return normalized;
}

/**
 * Check if query contains at least one known dictionary word.
 * Allows misspellings — words within Levenshtein distance 2 of a dictionary word count.
 */
export function dictionaryCheck(tokens: string[]): { valid: boolean; matchedWords: number; fuzzyRequired: boolean } {
  let matchedExact = 0;
  let matchedFuzzy = 0;

  for (const token of tokens) {
    if (token.length < 2) continue; // Skip single chars
    if (COMMON_WORDS.has(token)) {
      matchedExact++;
    } else {
      // Check fuzzy match (Levenshtein distance <= 2)
      for (const word of COMMON_WORDS) {
        if (Math.abs(word.length - token.length) > 2) continue;
        if (levenshteinDistance(token, word) <= 2) {
          matchedFuzzy++;
          break;
        }
      }
    }
  }

  const totalMatched = matchedExact + matchedFuzzy;
  return {
    valid: totalMatched > 0,
    matchedWords: totalMatched,
    fuzzyRequired: matchedFuzzy > 0 && matchedExact === 0,
  };
}

/**
 * Expand query with synonyms from maintained dictionary.
 */
export function expandSynonyms(tokens: string[]): string[] {
  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);
    const group = synonymMap.get(token);
    if (group) {
      for (const syn of group) {
        if (syn !== token) expanded.add(syn);
      }
    }
  }

  // Also check multi-word phrases
  const phrase = tokens.join(' ');
  const phraseGroup = synonymMap.get(phrase);
  if (phraseGroup) {
    for (const syn of phraseGroup) {
      expanded.add(syn);
    }
  }

  return Array.from(expanded);
}

/**
 * Full query processing pipeline.
 * Returns processed query ready for Elasticsearch.
 */
export function processQuery(rawQuery: string): { result: ProcessedQuery } | { error: QueryValidationResult } {
  // Step 1: Validate
  const validation = validateQuery(rawQuery);
  if (!validation.valid) {
    return { error: validation };
  }

  // Step 2: Normalize
  const normalized = normalizeQuery(rawQuery);
  const tokens = normalized.split(' ').filter(t => t.length > 0);

  // Step 3: Dictionary check
  const dictResult = dictionaryCheck(tokens);
  if (!dictResult.valid) {
    return {
      error: {
        valid: false,
        error: 'No recognizable products found for your search. Try different terms.',
        errorCode: 'NO_DICTIONARY_MATCH',
      },
    };
  }

  // Step 4: Synonym expansion
  const synonyms = expandSynonyms(tokens);

  return {
    result: {
      original: rawQuery,
      normalized,
      tokens,
      synonyms,
      fuzzyRequired: dictResult.fuzzyRequired,
      dictionaryWordsFound: dictResult.matchedWords,
    },
  };
}

/**
 * Levenshtein distance — edit distance between two strings.
 * Used for fuzzy matching (spec: Levenshtein distance <= 2 triggers fuzzy search).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Optimization: if length difference > 2, distance must be > 2
  if (Math.abs(m - n) > 2) return Math.abs(m - n);

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // deletion
        dp[i][j - 1] + 1,       // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[m][n];
}
