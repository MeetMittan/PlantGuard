import { z } from 'zod';

/**
 * Typed, validated application configuration.
 *
 * This is the ONLY module that reads `import.meta.env`. All values are public
 * client-side build-time configuration (Vite inlines them into the bundle), so
 * secrets must never be placed here. See docs/ENVIRONMENT.md.
 */

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const optionalString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const positiveInt = (fallback: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === '') return fallback;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        ctx.addIssue({ code: 'custom', message: `must be an integer between ${min} and ${max}` });
        return z.NEVER;
      }
      return parsed;
    });

const urlString = (fallback: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const candidate = value && value.trim() !== '' ? value.trim() : fallback;
      try {
        // Tile URLs contain {z}/{x}/{y}; replace placeholders before URL parsing.
        new URL(candidate.replace(/\{[a-z]\}/g, '0'));
        return candidate;
      } catch {
        ctx.addIssue({ code: 'custom', message: `"${candidate}" is not a valid absolute URL` });
        return z.NEVER;
      }
    });

export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export const envSchema = z.object({
  VITE_APP_NAME: z.string().optional().transform((v) => v?.trim() || 'PlantGuard AI'),
  VITE_DEFAULT_LOCALE: z.string().optional().transform((v, ctx) => {
    const locale = v?.trim() || 'en-IN';
    try {
      new Intl.DateTimeFormat(locale);
      return locale;
    } catch {
      ctx.addIssue({ code: 'custom', message: `"${locale}" is not a valid BCP 47 locale` });
      return z.NEVER;
    }
  }),

  VITE_AI_PROVIDER: z.enum(['gemini', 'transformersjs', 'demo']).optional().default('gemini'),
  VITE_API_BASE_URL: optionalString,
  VITE_AI_MODEL_ID: optionalString,
  VITE_AI_MODEL_REVISION: optionalString,
  VITE_AI_MODEL_DTYPE: optionalString,
  VITE_AI_MAX_IMAGE_DIMENSION: positiveInt(768, 256, 2048),
  VITE_AI_MAX_NEW_TOKENS: positiveInt(160, 32, 512),
  VITE_AI_REMOTE_HOST: urlString('https://huggingface.co/'),
  VITE_AI_WASM_BASE_URL: optionalString,

  VITE_MAP_TILE_URL: urlString(DEFAULT_TILE_URL),
  VITE_MAP_ATTRIBUTION: optionalString,
  VITE_MAP_MAX_ZOOM: positiveInt(19, 1, 22),

  VITE_ENABLE_GEOLOCATION: z
    .enum(['true', 'false', '1', '0', ''])
    .optional()
    .transform((value) => value !== 'false' && value !== '0'),
  VITE_ENABLE_DEMO_MODE: booleanString,
});

export type RawEnv = z.input<typeof envSchema>;

export interface AppConfig {
  appName: string;
  appVersion: string;
  locale: string;
  basePath: string;
  ai: {
    provider: 'gemini' | 'transformersjs' | 'demo';
    apiBaseUrl: string;
    /** Model id override. When undefined the default preset is used. */
    modelId: string | undefined;
    modelRevision: string | undefined;
    /** Raw dtype override string, parsed by the model preset module. */
    modelDtype: string | undefined;
    maxImageDimension: number;
    maxNewTokens: number;
    remoteHost: string;
    wasmBaseUrl: string | undefined;
  };
  map: {
    tileUrl: string;
    attribution: string;
    maxZoom: number;
  };
  features: {
    geolocation: boolean;
  };
}

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid PlantGuard configuration:\n- ${issues.join('\n- ')}`);
    this.name = 'ConfigError';
  }
}

export function parseConfig(
  raw: Record<string, string | boolean | undefined>,
  meta: { appVersion: string; basePath: string },
): AppConfig {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const env = result.data;

  // The demo provider returns simulated results. It must be opted into twice
  // (provider + demo flag) so a production build can never use it by accident.
  if (env.VITE_AI_PROVIDER === 'demo' && !env.VITE_ENABLE_DEMO_MODE) {
    throw new ConfigError([
      'VITE_AI_PROVIDER=demo requires VITE_ENABLE_DEMO_MODE=true. The demo provider returns simulated results and must be enabled explicitly.',
    ]);
  }

  const usesDefaultTiles = env.VITE_MAP_TILE_URL === DEFAULT_TILE_URL;
  const attribution = env.VITE_MAP_ATTRIBUTION ?? (usesDefaultTiles ? DEFAULT_TILE_ATTRIBUTION : undefined);
  if (!attribution) {
    throw new ConfigError(['VITE_MAP_ATTRIBUTION is required when VITE_MAP_TILE_URL points to a custom tile provider.']);
  }

  return {
    appName: env.VITE_APP_NAME,
    appVersion: meta.appVersion,
    locale: env.VITE_DEFAULT_LOCALE,
    basePath: meta.basePath,
    ai: {
      provider: env.VITE_AI_PROVIDER,
      apiBaseUrl: (env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/+$/, ''),
      modelId: env.VITE_AI_MODEL_ID,
      modelRevision: env.VITE_AI_MODEL_REVISION,
      modelDtype: env.VITE_AI_MODEL_DTYPE,
      maxImageDimension: env.VITE_AI_MAX_IMAGE_DIMENSION,
      maxNewTokens: env.VITE_AI_MAX_NEW_TOKENS,
      remoteHost: env.VITE_AI_REMOTE_HOST.endsWith('/') ? env.VITE_AI_REMOTE_HOST : `${env.VITE_AI_REMOTE_HOST}/`,
      wasmBaseUrl: env.VITE_AI_WASM_BASE_URL,
    },
    map: {
      tileUrl: env.VITE_MAP_TILE_URL,
      attribution,
      maxZoom: env.VITE_MAP_MAX_ZOOM,
    },
    features: {
      geolocation: env.VITE_ENABLE_GEOLOCATION,
    },
  };
}

export const config: AppConfig = parseConfig(import.meta.env, {
  appVersion: __APP_VERSION__,
  basePath: import.meta.env.BASE_URL,
});
