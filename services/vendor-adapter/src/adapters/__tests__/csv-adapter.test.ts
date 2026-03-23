import { describe, it, expect } from 'vitest';
import { CsvAdapter } from '../csv-adapter.js';

const CSV_CONTENT = `name,price,brand,category,on_sale
"Organic Apples 3lb","$4.99","Nature Best","grocery","true"
"Whole Wheat Bread","$3.49","Bakery Fresh","grocery","false"
"Cotton T-Shirt","$12.99","BasicWear","clothing","true"`;

const COLUMN_MAP = {
  name: 'name',
  price: 'price',
  brand: 'brand',
  category: 'category',
  on_sale: 'on_sale',
};

describe('CsvAdapter', () => {
  const adapter = new CsvAdapter();

  describe('validateConfig', () => {
    it('accepts valid config with content', () => {
      expect(adapter.validateConfig({ content: 'data', column_map: COLUMN_MAP })).toBe(true);
    });

    it('accepts valid config with source_url', () => {
      expect(adapter.validateConfig({ source_url: 'https://example.com/feed.csv', column_map: COLUMN_MAP })).toBe(true);
    });

    it('rejects missing content and source_url', () => {
      const result = adapter.validateConfig({ column_map: COLUMN_MAP });
      expect(typeof result).toBe('string');
    });

    it('rejects missing column_map', () => {
      const result = adapter.validateConfig({ content: 'data' });
      expect(typeof result).toBe('string');
    });
  });

  describe('extract', () => {
    it('parses valid CSV content', async () => {
      const result = await adapter.extract({ content: CSV_CONTENT, column_map: COLUMN_MAP });
      expect(result.success).toBe(true);
      expect(result.products).toHaveLength(3);
      expect(result.products[0].raw_name).toBe('Organic Apples 3lb');
      expect(result.products[0].raw_price).toBe('$4.99');
      expect(result.products[0].on_sale).toBe(true);
    });

    it('extracts brand and category', async () => {
      const result = await adapter.extract({ content: CSV_CONTENT, column_map: COLUMN_MAP });
      expect(result.products[0].brand).toBe('Nature Best');
      expect(result.products[0].category).toBe('grocery');
    });

    it('returns error for empty content', async () => {
      const result = await adapter.extract({ content: '', column_map: COLUMN_MAP });
      expect(result.success).toBe(false);
    });

    it('returns error for header-only CSV', async () => {
      const result = await adapter.extract({ content: 'name,price', column_map: COLUMN_MAP });
      expect(result.success).toBe(false);
    });

    it('skips rows with missing required fields', async () => {
      const csv = `name,price\n"Product A","$4.99"\n,"$3.00"\n"Product C",`;
      const result = await adapter.extract({ content: csv, column_map: { name: 'name', price: 'price' } });
      // Only "Product A" has both name and price
      expect(result.products).toHaveLength(1);
    });

    it('handles custom delimiters', async () => {
      const tsvContent = "name\tprice\nApples\t4.99";
      const result = await adapter.extract({
        content: tsvContent,
        column_map: { name: 'name', price: 'price' },
        delimiter: '\t',
      });
      expect(result.success).toBe(true);
      expect(result.products[0].raw_name).toBe('Apples');
    });

    it('handles quoted fields with commas', async () => {
      const csv = `name,price\n"Bread, Whole Wheat","$3.49"`;
      const result = await adapter.extract({ content: csv, column_map: { name: 'name', price: 'price' } });
      expect(result.products[0].raw_name).toBe('Bread, Whole Wheat');
    });

    it('reports extraction time', async () => {
      const result = await adapter.extract({ content: CSV_CONTENT, column_map: COLUMN_MAP });
      expect(result.extraction_time_ms).toBeGreaterThanOrEqual(0);
    });

    it('sets source from config', async () => {
      const result = await adapter.extract({
        content: CSV_CONTENT,
        column_map: COLUMN_MAP,
        source_url: 'https://store.example.com/feed.csv',
      });
      expect(result.source).toBe('https://store.example.com/feed.csv');
    });
  });
});
