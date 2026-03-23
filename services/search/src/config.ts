// Environment config validated at startup per security.validate_all_untrusted_input
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3002'),
  LOG_LEVEL: z.string().default('7'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_DB: z.string().default('trackhat_search'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),

  ELASTICSEARCH_HOST: z.string().default('localhost'),
  ELASTICSEARCH_PORT: z.string().default('9200'),
  ELASTICSEARCH_USERNAME: z.string().default('elastic'),
  ELASTICSEARCH_PASSWORD: z.string().default(''),

  SEARCH_DEFAULT_PAGE_SIZE: z.string().default('20'),
  SEARCH_MAX_PAGE_SIZE: z.string().default('100'),

  CORS_ORIGIN: z.string().default('https://localhost'),
});

export const config = configSchema.parse(process.env);
