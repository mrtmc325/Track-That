// Environment config validated at startup per security.validate_all_untrusted_input
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3005'),
  LOG_LEVEL: z.string().default('7'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.string().default('5432'),
  POSTGRES_DB: z.string().default('trackhat_delivery'),
  POSTGRES_USER: z.string().default('postgres'),
  POSTGRES_PASSWORD: z.string().default(''),

  DELIVERY_PROVIDER_TIMEOUT_MS: z.string().default('10000'),
  DELIVERY_MAX_RETRIES: z.string().default('3'),

  CORS_ORIGIN: z.string().default('https://localhost'),
});

export const config = configSchema.parse(process.env);
