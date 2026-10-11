import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_ORIGIN: z.string().trim().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGODB_URI: z.string().trim().default('mongodb://127.0.0.1:27017/plantguard_ai'),

  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),

  ACCESS_TOKEN_SECRET: z.string().trim().min(16).default('plantguard_dev_access_secret_super_secure_32chars!'),
  REFRESH_TOKEN_SECRET: z.string().trim().min(16).default('plantguard_dev_refresh_secret_super_secure_32chars!'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  COOKIE_SECURE: z.coerce.boolean().default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  STORAGE_PROVIDER: z.enum(['local', 'memory']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage/uploads'),

  MAX_IMAGE_UPLOAD_MB: z.coerce.number().min(1).max(50).default(10),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  AI_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(15),
  REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000),
});

export type ServerEnv = z.infer<typeof envSchema> & {
  isAiConfigured: boolean;
  allowedOrigins: string[];
};

function parseOrigins(raw: string): string[] {
  if (raw === '*') return ['*'];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function loadEnv(): ServerEnv {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }

  const raw = result.data;
  const isAiConfigured = Boolean(raw.GEMINI_API_KEY && raw.GEMINI_API_KEY.length > 5);
  const allowedOrigins = parseOrigins(raw.CLIENT_ORIGIN);

  return {
    ...raw,
    isAiConfigured,
    allowedOrigins,
  };
}

export const env = loadEnv();

