import path from 'node:path';
import { expect, test } from '@playwright/test';
import { completeOnboarding, setUpModel } from './helpers';

const FIXTURE = path.resolve('tests/fixtures/tomato-early-blight.jpg');

test('same plant scanned twice → timeline in order → deterministic comparison', async ({ page }) => {
  await completeOnboarding(page);
  await setUpModel(page);

  // Create a plant.
  await page.goto('/garden');
  await page.getByRole('button', { name: /add plant/i }).first().click();
  await page.getByLabel('Name', { exact: true }).fill('Balcony tomato');
  await page.getByRole('dialog').getByRole('button', { name: /^add plant$/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Balcony tomato' })).toBeVisible();
  const plantUrl = page.url();

  // First scan from the plant page (plant pre-selected).
  await page.getByRole('link', { name: /scan this plant again/i }).click();
  await expect(page.getByRole('heading', { name: /scan balcony tomato/i })).toBeVisible();
  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  await page.getByLabel(/name for this observation/i).fill('Week 1');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByText('What the model observed')).toBeVisible();
  await expect(page.getByRole('radio', { name: /add to an existing plant/i })).toBeChecked();
  // Backdate the first observation so the two are clearly ordered.
  await page.getByLabel('Observed on').fill('2026-01-05T09:00');
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();

  // Second scan, scripted by the demo provider to report different symptoms.
  await page.getByRole('button', { name: /scan another/i }).click();
  await page.getByTestId('photo-input').setInputFiles(FIXTURE);
  await page.getByLabel(/name for this observation/i).fill('Week 2');
  await page.getByLabel(/context for the ai/i).fill('powdery patches now');
  await page.getByRole('button', { name: /analyse on this device/i }).click();
  await expect(page.getByText('Powdery or fuzzy surface', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /save observation/i }).click();
  await expect(page.getByRole('heading', { name: /observation saved/i })).toBeVisible();

  // Care log entry.
  await page.goto(plantUrl);
  await page.getByRole('button', { name: /add care log/i }).click();
  await page.getByRole('dialog').getByLabel(/details/i).fill('Soil was dry');
  await page.getByRole('dialog').getByRole('button', { name: /add entry/i }).click();
  await expect(page.getByText('Soil was dry')).toBeVisible();

  // Timeline: newest first, all event types in one chronology.
  await page.getByRole('link', { name: /full timeline/i }).click();
  const items = page.getByRole('list', { name: /balcony tomato timeline/i }).getByRole('listitem');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText('Watering');
  await expect(items.nth(1)).toContainText('Week 2');
  await expect(items.nth(2)).toContainText('Week 1');

  // Compare the two observations.
  await page.getByRole('checkbox', { name: /compare/i }).first().check();
  await page.getByRole('checkbox', { name: /compare/i }).nth(1).check();
  await page.getByRole('button', { name: /^compare$/i }).click();
  await expect(page.getByRole('heading', { name: /compare observations/i })).toBeVisible();
  await expect(page.getByText('Mentioned in both').locator('..')).toContainText('Brown or dark spots');
  await expect(page.getByText('Only in the later assessment').locator('..')).toContainText('Powdery or fuzzy surface');
  await expect(page.getByText('Not mentioned in the later assessment').locator('..')).toContainText('Yellow discoloration');
  await expect(page.getByText(/this does not mean it has gone/i)).toBeVisible();
  await expect(page.getByText(/cannot confirm whether the underlying condition has improved or worsened/i).first()).toBeVisible();

  // Reload: history persists.
  await page.reload();
  await expect(page.getByRole('heading', { name: /compare observations/i })).toBeVisible();
});

test('model download can be cancelled and retried', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/settings#ai-model');
  await page.getByRole('button', { name: /download ai model/i }).first().click();
  await page.getByRole('dialog', { name: /download the ai model/i }).getByRole('button', { name: /^download$/i }).click();
  const readiness = page.locator('section[aria-labelledby="model-readiness-title"]').first();
  await readiness.getByRole('button', { name: /^cancel$/i }).click();
  await expect(page.getByText('Download cancelled')).toBeVisible();
  await expect(readiness.getByRole('heading', { name: /ai not downloaded/i })).toBeVisible();
  // Retry works after cancelling.
  await readiness.getByRole('button', { name: /download ai model/i }).click();
  await page.getByRole('dialog', { name: /download the ai model/i }).getByRole('button', { name: /^download$/i }).click();
  await expect(page.getByRole('link', { name: /demo ai ready/i }).first()).toBeVisible();
});
