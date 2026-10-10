import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

/** Manual real-model verification: `npm run verify:inference`. Not used by CI. */
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify('verify') },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.verify.ts'],
    testTimeout: 30 * 60 * 1000,
    // Stream console output as the model runs.
    silent: false,
  },
});
