import path from 'node:path';
import { expect, test as base } from '@playwright/test';
import { completeOnboarding } from '../e2e/helpers';
import { startAssetServer } from './asset-server';

const test = base.extend<{ assetHost: string }>({
  assetHost: async ({ baseURL }, provide) => {
    void baseURL;
    const server = await startAssetServer();
    try { await provide(server.origin); } finally { server.close(); }
  },
});

test('real worker: cancel, retry, local scan, offline reload, persistence and cache eviction', async ({ page, context, assetHost }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Exercise the production remote-host URLs, substituting identical pinned
  // files from the Node verification cache to make downloads reproducible.
  await context.route('https://huggingface.co/**', async (route) => {
    const parts = new URL(route.request().url()).pathname.slice(1).split('/');
    const resolveIndex = parts.indexOf('resolve');
    if (resolveIndex < 0) return route.abort();
    parts.splice(resolveIndex, 1);
    await route.fulfill({ status: 302, headers: { location: `${assetHost}/models/${parts.join('/')}`, 'Access-Control-Allow-Origin': '*' } });
  });
  await context.route('https://cdn.jsdelivr.net/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    await route.fulfill({ status: 302, headers: { location: `${assetHost}/runtime/${name}`, 'Access-Control-Allow-Origin': '*' } });
  });
  await completeOnboarding(page);
  await page.goto('/settings#ai-model');
  await page.getByLabel('Acceleration').selectOption('wasm');
  await page.getByRole('button', { name: /download ai model/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^download$/i }).click();
  await page.getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.getByRole('button', { name: /download ai model/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /download ai model/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^download$/i }).click();
  await expect(page.getByRole('heading', { name: 'AI ready offline' })).toBeVisible({ timeout: 300_000 });
  console.log('Real model initialized and fully cached.');

  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(path.resolve('tests/fixtures/tomato-early-blight.jpg'));
  await page.getByLabel(/name for this observation/i).fill('Real local leaf');
  await page.evaluate(() => {
    const state = window as unknown as { inferenceFrames: number; frameGap: number; measureFrames: boolean };
    state.inferenceFrames = 0; state.frameGap = 0; state.measureFrames = true;
    let previous = performance.now();
    const tick = (now: number) => {
      state.inferenceFrames++;
      state.frameGap = Math.max(state.frameGap, now - previous);
      previous = now;
      if (state.measureFrames) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByRole('button', { name: /save observation/i })).toBeVisible({ timeout: 300_000 });
  const frames = await page.evaluate(() => {
    const state = window as unknown as { inferenceFrames: number; frameGap: number; measureFrames: boolean };
    state.measureFrames = false;
    return { frames: state.inferenceFrames, maxFrameGapMs: Math.round(state.frameGap) };
  });
  expect(frames.frames).toBeGreaterThan(10);
  expect(frames.maxFrameGapMs).toBeLessThan(2000);
  await testInfo.attach('responsiveness.json', { body: JSON.stringify(frames), contentType: 'application/json' });
  console.log('Real online inference:', frames);
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto('/history');
  await expect(page.getByText('Real local leaf')).toBeVisible();
  await page.goto('/settings/ai-model/diagnostics');
  await page.getByRole('button', { name: /analyse sample photo/i }).click();
  await expect(page.getByText(/isPlant:/)).toBeVisible({ timeout: 300_000 });
  console.log('Real cold offline inference passed.');
  await expect(page.getByText(/MODEL_ASSETS_MISSING|INFERENCE_FAILED|MODEL_DOWNLOAD_FAILED/)).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('real-offline-inference.png'), fullPage: true });
  const manifest = await page.evaluate(async () => {
    const cache = await caches.open('transformers-cache');
    const urls = (await cache.keys()).map((key) => key.url);
    const weight = urls.find((url) => url.endsWith('decoder_model_merged_q4.onnx'))!;
    await cache.delete(weight);
    return urls;
  });
  await testInfo.attach('cached-assets.json', { body: JSON.stringify(manifest, null, 2), contentType: 'application/json' });
  await page.goto('/settings');
  await page.getByRole('button', { name: /re-check storage/i }).click();
  await expect(page.getByRole('heading', { name: 'AI needs internet once' })).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText('Real local leaf')).toBeVisible();
  expect(errors).toEqual([]);
});

test('unsupported worker devices retain gallery capture and unassessed saving', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Worker', { value: undefined, configurable: true }); });
  await completeOnboarding(page);
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'AI unsupported here' })).toBeVisible();
  await expect(page.getByText(/does not support Web Workers/)).toBeVisible();
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(path.resolve('tests/fixtures/tomato-early-blight.jpg'));
  await expect(page.getByRole('heading', { name: /save without analysis/i })).toBeVisible();
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();
});
