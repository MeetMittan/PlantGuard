import { defineConfig, devices } from '@playwright/test';

/** Real weights supplied from verify:inference's pinned local download; no demo provider. */
export default defineConfig({
  testDir: 'tests/real-browser',
  workers: 1,
  timeout: 600_000,
  outputDir: 'test-results-real',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4193', serviceWorkers: 'allow', screenshot: 'only-on-failure', actionTimeout: 30_000 },
  webServer: {
    command: 'npx vite build --outDir dist-real --emptyOutDir && npx vite preview --outDir dist-real --port 4193 --strictPort',
    url: 'http://localhost:4193',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_AI_PROVIDER: 'transformersjs', VITE_ENABLE_DEMO_MODE: 'false' },
  },
});
