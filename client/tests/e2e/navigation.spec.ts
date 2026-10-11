import { expect, test } from '@playwright/test';
import { completeOnboarding, navigate } from './helpers';

const DESTINATIONS: Array<[RegExp, RegExp]> = [
  [/history/i, /^history$/i],
  [/my garden/i, /^my garden$/i],
  [/care/i, /^care & streaks$/i],
  [/explorer/i, /^nature explorer$/i],
  [/settings/i, /^settings$/i],
  [/home/i, /your plants, at a glance/i],
];

test('every primary destination is reachable and direct-route refresh works', async ({ page }) => {
  await completeOnboarding(page);
  for (const [link, heading] of DESTINATIONS) {
    await navigate(page, link);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  }
  // SPA fallback: a hard refresh on a deep route still renders the app.
  await page.goto('/garden');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /my garden/i })).toBeVisible();
});

test('map explorer never requests location on its own and shows attribution', async ({ page, context }) => {
  await context.grantPermissions([]);
  let geolocationCalls = 0;
  await page.exposeFunction('__countGeo', () => {
    geolocationCalls += 1;
  });
  await page.addInitScript(() => {
    const original = navigator.geolocation?.getCurrentPosition?.bind(navigator.geolocation);
    if (original) {
      navigator.geolocation.getCurrentPosition = (...args: Parameters<Geolocation['getCurrentPosition']>) => {
        (window as unknown as { __countGeo: () => void }).__countGeo();
        return original(...args);
      };
    }
  });
  await completeOnboarding(page);
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: /nature explorer/i })).toBeVisible();
  await expect(page.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  expect(geolocationCalls).toBe(0);
});

test('settings persist and dialogs support keyboard escape without changing data', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await completeOnboarding(page);
  await page.goto('/settings');
  await page.getByRole('radio', { name: 'Dark', exact: true }).click();
  await page.getByLabel('Your name (optional)').fill('Field gardener');
  await page.getByRole('switch', { name: /keep photos with new observations/i }).click();
  await expect(page.getByRole('switch', { name: /keep photos with new observations/i })).not.toBeChecked();
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByLabel('Your name (optional)')).toHaveValue('Field gardener');
  await expect(page.getByRole('switch', { name: /keep photos with new observations/i })).not.toBeChecked();
  await page.getByRole('button', { name: /clear all local data/i }).click();
  await expect(page.getByRole('dialog', { name: /clear all local data/i })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /clear all local data/i })).toBeFocused();
  await page.getByRole('link', { name: /model diagnostics/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /model diagnostics/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test('primary screens fit a narrow viewport and expose keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await completeOnboarding(page);
  for (const route of ['/scan', '/history', '/garden', '/care', '/explore', '/settings']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${route} has horizontal overflow`).toBe(false);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /your plants, at a glance/i })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
});
