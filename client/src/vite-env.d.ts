/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_LOCALE?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_AI_PROVIDER?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AI_MODEL_ID?: string;
  readonly VITE_AI_MODEL_REVISION?: string;
  readonly VITE_AI_MODEL_DTYPE?: string;
  readonly VITE_AI_MAX_IMAGE_DIMENSION?: string;
  readonly VITE_AI_MAX_NEW_TOKENS?: string;
  readonly VITE_AI_REMOTE_HOST?: string;
  readonly VITE_AI_WASM_BASE_URL?: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_MAP_ATTRIBUTION?: string;
  readonly VITE_MAP_MAX_ZOOM?: string;
  readonly VITE_ENABLE_GEOLOCATION?: string;
  readonly VITE_ENABLE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
