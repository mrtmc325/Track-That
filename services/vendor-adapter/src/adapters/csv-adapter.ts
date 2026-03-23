/**
 * CSV/Spreadsheet Adapter Plugin
 * Parses product data from CSV content (file content or URL response).
 * Simplest adapter — good for stores that provide product feeds as CSV.
 */
import type { VendorAdapter, AdapterResult, RawProduct, AdapterType } from './adapter.interface.js';
import { logger } from '../utils/logger.js';

export class CsvAdapter implements VendorAdapter {
  readonly type: AdapterType = 'csv';

  validateConfig(config: Record<string, unknown>): string | true {
    if (!config.content && !config.source_url) {
      return 'CSV adapter requires either "content" (raw CSV) or "source_url"';
    }
    // Column mapping is required to know which columns map to which fields
    if (!config.column_map || typeof config.column_map !== 'object') {
      return 'CSV adapter requires "column_map" object mapping CSV columns to product fields';
    }
    return true;
  }

  async extract(config: Record<string, unknown>): Promise<AdapterResult> {
    const startTime = Date.now();
    const products: RawProduct[] = [];
    const errors: string[] = [];
    const source = (config.source_url as string) || 'csv-upload';

    try {
      const content = config.content as string;
      if (!content) {
        return { success: false, products: [], errors: ['No CSV content provided'], extraction_time_ms: 0, source };
      }

      const columnMap = config.column_map as Record<string, string>;
      const delimiter = (config.delimiter as string) || ',';
      const lines = content.split('\n').filter(l => l.trim().length > 0);

      if (lines.length < 2) {
        return { success: false, products: [], errors: ['CSV must have header + at least 1 data row'], extraction_time_ms: 0, source };
      }

      // Parse header
      const headers = parseCsvLine(lines[0], delimiter);
      const colIndex = new Map<string, number>();
      headers.forEach((h, i) => colIndex.set(h.trim().toLowerCase(), i));

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCsvLine(lines[i], delimiter);
          const product = mapRowToProduct(values, colIndex, columnMap, source);
          if (product) {
            products.push(product);
          }
        } catch (err) {
          errors.push(`Row ${i + 1}: ${(err as Error).message}`);
        }
      }

      logger.info('adapter.csv.extract', 'CSV extraction complete', {
        products_found: products.length,
        errors_count: errors.length,
        source,
      });

      return {
        success: products.length > 0,
        products,
        errors,
        extraction_time_ms: Date.now() - startTime,
        source,
      };
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('adapter.csv.extract', 'CSV extraction failed', { error: msg, source });
      return { success: false, products: [], errors: [msg], extraction_time_ms: Date.now() - startTime, source };
    }
  }
}

/** Simple CSV line parser that handles quoted fields */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // Skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function mapRowToProduct(
  values: string[],
  colIndex: Map<string, number>,
  columnMap: Record<string, string>,
  source: string,
): RawProduct | null {
  const get = (field: string): string => {
    const csvCol = columnMap[field];
    if (!csvCol) return '';
    const idx = colIndex.get(csvCol.toLowerCase());
    if (idx === undefined || idx >= values.length) return '';
    return values[idx].trim();
  };

  const rawName = get('name');
  const rawPrice = get('price');

  if (!rawName || !rawPrice) return null;

  return {
    raw_name: rawName,
    raw_price: rawPrice,
    original_price: get('original_price') || undefined,
    on_sale: get('on_sale')?.toLowerCase() === 'true' || get('on_sale') === '1',
    source_url: source,
    brand: get('brand') || undefined,
    category: get('category') || undefined,
    image_url: get('image_url') || undefined,
    description: get('description') || undefined,
    unit_of_measure: get('unit') || undefined,
  };
}
