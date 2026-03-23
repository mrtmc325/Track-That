// Environment config validated at startup per security.validate_all_untrusted_input
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3003'),
  LOG_LEVEL: z.string().default('7'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_DB: z.string().default('trackhat_prices'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().default(''),

  PRICE_CACHE_TTL_SECONDS: z.string().default('300'),
  PRICE_HISTORY_RETENTION_DAYS: z.string().default('90'),

  CORS_ORIGIN: z.string().default('https://localhost'),
});

export const config = configSchema.parse(process.env);
