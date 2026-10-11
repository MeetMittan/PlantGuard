import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

/**
 * onnxruntime-web references its WASM binaries via new URL(..., import.meta.url),
 * so Vite copies a ~26 MB file into the build. PlantGuard never loads that copy:
 * Transformers.js always sets explicit wasmPaths (jsDelivr by default, or
 * VITE_AI_WASM_BASE_URL) and caches the binary in the Cache API. Dropping it keeps
 * deployments under static-host file limits (Cloudflare Pages: 25 MiB per file).
 */
function dropBundledOrtWasm(): Plugin {
  return {
    name: 'plantguard:drop-bundled-ort-wasm',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/ort-wasm[^/]*\.wasm$/.test(fileName)) delete bundle[fileName];
      }
    },
  };
}

/** A concrete inventory lets Settings check for evicted app chunks, not just an active SW. */
function offlineAssetInventory(): Plugin {
  return {
    name: 'plantguard:offline-asset-inventory',
    enforce: 'post',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((name) => /\.(js|css|html|woff2)$/.test(name));
      this.emitFile({ type: 'asset', fileName: 'offline-assets.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // Base path is needed for sub-path hosting such as GitHub Pages ("/plantguard-ai/").
  const base = normalizeBase(env.VITE_BASE_PATH);
  const appName = env.VITE_APP_NAME || 'PlantGuard AI';

  return {
    base,
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      dropBundledOrtWasm(),
      react(),
      tailwindcss(),
      offlineAssetInventory(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'robots.txt', 'icons/apple-touch-icon.png'],
        manifest: {
          name: appName,
          short_name: 'PlantGuard',
          description:
            'Offline-first plant and leaf health observations with AI plant health assistance.',
          theme_color: '#1f4d36',
          background_color: '#f7f4ec',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: base,
          scope: base,
          categories: ['lifestyle', 'education', 'utilities'],
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // App shell + lazily loaded route/worker chunks are precached so every screen opens offline.
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2,ico,webmanifest,json}'],
          // The Transformers.js worker chunk is large; allow it into the precache.
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api/],
          cleanupOutdatedCaches: true,
          // Deliberately NO runtimeCaching rules:
          // - AI API calls (/api/ai/analyze) must never be cached by the service worker.
          // - Map tiles are not cached by the service worker to respect tile usage policies.
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    worker: { format: 'es', plugins: () => [dropBundledOrtWasm()] },
    optimizeDeps: {
      // Transformers.js ships its own pre-bundled web build; pre-bundling it again breaks
      // its dynamic ONNX Runtime imports.
      exclude: ['@huggingface/transformers'],
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 2500,
    },
  };
});

function normalizeBase(value: string | undefined): string {
  if (!value || value === '/') return '/';
  const trimmed = value.replace(/^\/+|\/+$/g, '');
  return `/${trimmed}/`;
}
