import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  CLIENT_ORIGIN: z.string().trim().default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000), // 15 mins
  MAX_UPLOAD_MB: z.coerce.number().min(1).max(50).default(10),
  REQUEST_TIMEOUT_MS: z.coerce.number().min(1000).max(120000).default(30000), // 30s
});

export type ServerConfig = z.infer<typeof configSchema> & {
  isConfigured: boolean;
  allowedOrigins: string[];
};

function parseOrigins(raw: string): string[] {
  if (raw === '*') return ['*'];
  return raw
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function loadConfig(): ServerConfig {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }

  const raw = result.data;
  const isConfigured = Boolean(raw.GEMINI_API_KEY && raw.GEMINI_API_KEY.length > 5);
  const allowedOrigins = parseOrigins(raw.CLIENT_ORIGIN);

  return {
    ...raw,
    isConfigured,
    allowedOrigins,
  };
}

export const serverConfig = loadConfig();

