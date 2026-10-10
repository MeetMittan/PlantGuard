import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { completeOnboarding, navigate, setUpModel } from './helpers';

const FIXTURE = path.resolve('tests/fixtures/tomato-early-blight.jpg');

test('scan → save → history → care streak → export → reload persists', async ({ page }) => {
  await completeOnboarding(page);
  await expect(page.getByText(/demo mode: ai results are simulated/i)).toBeVisible();

  // The model is never downloaded automatically.
  await expect(page.getByRole('link', { name: /ai not downloaded/i }).first()).toBeVisible();
  await setUpModel(page);

  // Scan with the test fixture and the deterministic demo provider.
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  await page.getByLabel(/name for this observation/i).fill('Balcony tomato');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByText('What the model observed')).toBeVisible();
  await expect(page.getByText('Possible issue', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Early blight', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();

  // History shows the saved observation.
  await navigate(page, /history/i);
  await expect(page.getByText('Balcony tomato')).toBeVisible();

  // Create and complete a care task; observation + task = 2 actions today.
  await navigate(page, /care/i);
  await page.getByLabel('Task', { exact: true }).fill('Water the herbs');
  await page.getByRole('button', { name: /add task/i }).click();
  await page.getByText('Water the herbs').first().click();
  await expect(page.getByText(/done today/i)).toBeVisible();
  const streakCard = page.getByRole('region', { name: 'Streak summary' });
  await expect(streakCard.getByText(/current streak/i)).toBeVisible();
  await expect(streakCard).toContainText('1days');
  await expect(streakCard).toContainText('2/ 1');

  // Completing the same task again on the same day never double-counts.
  await page.getByText('Water the herbs').first().click(); // un-complete
  await page.getByText('Water the herbs').first().click(); // complete again
  await expect(streakCard).toContainText('2/ 1');

  // Export (JSON, without photos) and validate the file contents.
  await navigate(page, /settings/i);
  await page.getByRole('switch', { name: /include photos/i }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /export backup/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^plantguard-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.format).toBe('plantguard-backup');
  expect(backup.data.observations).toHaveLength(1);
  expect(backup.data.observations[0].label).toBe('Balcony tomato');
  expect(backup.data.careTasks).toHaveLength(1);
  expect(backup.data.careCompletions).toHaveLength(1);

  // Reload: everything persists in IndexedDB.
  await page.reload();
  await page.goto('/history');
  await expect(page.getByText('Balcony tomato')).toBeVisible();
});

test('inference failure shows an error and nothing is saved', async ({ page }) => {
  await completeOnboarding(page);
  await setUpModel(page);
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  // The demo provider simulates a failure when the context contains "fail".
  await page.getByLabel(/context for the ai/i).fill('please fail');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByRole('alert')).toContainText(/simulated demo failure/i);
  await expect(page.getByRole('button', { name: /analyse on this device/i })).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText(/no observations yet/i)).toBeVisible();
});

test('rejects a non-image file', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(path.resolve('tests/fixtures/not-an-image.jpg'));
  await expect(page.getByRole('alert')).toContainText(/does not look like a photo/i);
});

test('quota failure keeps the result and allows a smaller retry without partial history', async ({ page }) => {
  await completeOnboarding(page);
  await setUpModel(page);
  await page.goto('/scan');
  await page.getByTestId('photo-input').setInputFiles(path.resolve('tests/fixtures/tomato-early-blight.jpg'));
  await page.getByLabel(/name for this observation/i).fill('Quota retry leaf');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByText('What the model observed')).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.add;
    let failed = false;
    IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'observations' && !failed) {
        failed = true;
        throw new DOMException('Quota exhausted for verification', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('alert')).toContainText('INSUFFICIENT_STORAGE');
  await expect(page.getByText('What the model observed')).toBeVisible();
  await page.getByRole('switch', { name: /keep the full photo/i }).click();
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();
  await page.goto('/history');
  await expect(page.getByText('Quota retry leaf')).toHaveCount(1);
  await page.reload();
  await expect(page.getByText('Quota retry leaf')).toHaveCount(1);
});
