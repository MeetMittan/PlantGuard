import path from 'node:path';
import { expect, test } from '@playwright/test';
import { completeOnboarding, setUpModel } from './helpers';

test('app shell, saved data and analysis work offline after the first visit', async ({ page, context }) => {
  await completeOnboarding(page);
  await setUpModel(page);

  // Save one observation while online.
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(path.resolve('tests/fixtures/tomato-early-blight.jpg'));
  await page.getByLabel(/name for this observation/i).fill('Trail fern');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();

  // Wait until the service worker controls the page (first load is uncontrolled).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await context.setOffline(true);

  // A full reload while offline is served from the precache.
  await page.goto('/history');
  await expect(page.getByText('Trail fern')).toBeVisible();
  await expect(page.getByText('Offline', { exact: true }).filter({ visible: true })).toBeVisible();

  // Lazily loaded screens were precached too.
  await page.goto('/care');
  await expect(page.getByRole('heading', { name: /care & streaks/i })).toBeVisible();
  await page.getByLabel('Task', { exact: true }).fill('Offline check');
  await page.getByRole('button', { name: /add task/i }).click();
  await expect(page.getByText('Offline check').first()).toBeVisible();

  // The explorer stays usable as a list without map tiles.
  await page.goto('/explore');
  await expect(page.getByText(/you are offline, so the map background cannot load/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /nature explorer/i })).toBeVisible();

  await context.setOffline(false);
});

test('offline readiness detects an evicted app chunk', async ({ page }) => {
  await completeOnboarding(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.goto('/settings');
  await page.getByRole('button', { name: /re-check offline readiness/i }).click();
  await expect(page.getByText('App screens cached: yes')).toBeVisible();
  await page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('workbox-precache'));
    for (const name of names) {
      const cache = await caches.open(name);
      const chunk = (await cache.keys()).find((key) => key.url.includes('ComparePage-'));
      if (chunk) await cache.delete(chunk);
    }
  });
  await page.getByRole('button', { name: /re-check offline readiness/i }).click();
  await expect(page.getByText('App screens cached: no')).toBeVisible();
});
