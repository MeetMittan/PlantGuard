import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against a real production build (service worker
 * included) served by `vite preview`. The build uses the explicitly labelled
 * demo provider so CI never downloads a model; real inference is verified
 * separately (npm run verify:inference and docs/TESTING.md).
 */
const PORT = 4183;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    serviceWorkers: 'allow',
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] }, testMatch: /navigation\.spec\.ts/ },
  ],
  webServer: {
    command: `npx vite build --outDir dist-e2e --emptyOutDir && npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      VITE_AI_PROVIDER: 'demo',
      VITE_ENABLE_DEMO_MODE: 'true',
    },
  },
});
